// Load environment variables at the very top
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

// Import our new database module
const { 
  initializeDatabase, 
  getAllRestaurants,
  getNearbyRestaurants,
  getRestaurantByPlaceId,
  addRestaurant,
  addRating,
  getRestaurantRatings,
  migrateFromJSON
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Test Google Places API
app.get('/api/test-google', async (req, res) => {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return res.json({ error: 'Google Places API key not configured' });
  }
  
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params: {
        query: 'french toast restaurant',
        key: process.env.GOOGLE_PLACES_API_KEY
      }
    });
    
    res.json({
      status: 'success',
      found: response.data.results.length,
      sample: response.data.results[0]?.name || 'No results'
    });
  } catch (error) {
    res.json({
      status: 'error',
      message: error.response?.data?.error_message || error.message
    });
  }
});

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'LocalToast is cooking! 🍞' });
});

// Get nearby restaurants
app.get('/api/restaurants/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 5 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const restaurants = await getNearbyRestaurants(
      parseFloat(lat), 
      parseFloat(lng), 
      parseFloat(radius)
    );
    
    // If we have no restaurants, try to fetch some from OpenStreetMap
    if (restaurants.length === 0) {
      console.log('No restaurants in database, fetching from OpenStreetMap...');
      
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["amenity"="cafe"](around:2000,${lat},${lng});
          node["shop"="bakery"](around:2000,${lat},${lng});
          node["amenity"="restaurant"]["cuisine"~"breakfast"](around:2000,${lat},${lng});
        );
        out body;
      `;
      
      try {
        const response = await axios.post(
          'https://overpass-api.de/api/interpreter',
          `data=${encodeURIComponent(overpassQuery)}`,
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        
        const places = response.data.elements
          .filter(place => place.tags && place.tags.name)
          .slice(0, 5); // Just add first 5 automatically
        
        for (const place of places) {
          try {
            const newRestaurant = await addRestaurant({
              place_id: `osm_${place.id}`,
              name: place.tags.name,
              address: [
                place.tags['addr:street'],
                place.tags['addr:city']
              ].filter(Boolean).join(', ') || 'Address not available',
              latitude: place.lat,
              longitude: place.lon
            });
            restaurants.push(newRestaurant);
          } catch (err) {
            console.error('Error adding restaurant from OSM:', err);
          }
        }
      } catch (apiError) {
        console.error('Failed to fetch from OpenStreetMap:', apiError.message);
      }
    }

    res.json(restaurants);
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

// Add a new restaurant
app.post('/api/restaurants', async (req, res) => {
  try {
    const { place_id, name, address, latitude, longitude } = req.body;
    
    // Check if restaurant already exists
    const existing = await getRestaurantByPlaceId(place_id);
    if (existing) {
      return res.json(existing);
    }
    
    const newRestaurant = await addRestaurant({
      place_id,
      name,
      address,
      latitude,
      longitude
    });
    
    res.json(newRestaurant);
  } catch (error) {
    console.error('Error adding restaurant:', error);
    res.status(500).json({ error: 'Failed to add restaurant' });
  }
});

// Add a toast rating
app.post('/api/restaurants/:id/ratings', async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;
    
    // Simple toast detection
    if (review && review.length > 0) {
      const toastKeywords = ['toast', 'bread', 'butter', 'jam', 'marmalade', 'french toast', 'avocado'];
      const reviewLower = review.toLowerCase();
      const mentionsToast = toastKeywords.some(keyword => reviewLower.includes(keyword));
      
      if (!mentionsToast) {
        return res.status(400).json({ 
          error: 'Reviews must be about toast! Please mention the toast in your review.' 
        });
      }
    }
    
    const result = await addRating(parseInt(id), rating, review);
    res.json(result);
  } catch (error) {
    console.error('Error adding rating:', error);
    res.status(500).json({ error: 'Failed to add rating' });
  }
});

// Get ratings for a restaurant
app.get('/api/restaurants/:id/ratings', async (req, res) => {
  try {
    const { id } = req.params;
    const ratings = await getRestaurantRatings(parseInt(id));
    res.json(ratings);
  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

// Search for real restaurants using multiple APIs
app.get('/api/search/places', async (req, res) => {
  try {
    const { lat, lng, radius = 1000 } = req.query;
    
    console.log('Searching for places at:', { lat, lng, radius });
    
    // Try Google Places API first if available
    if (process.env.GOOGLE_PLACES_API_KEY) {
      console.log('Using Google Places API...');
      const textSearchUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
      
      try {
        const response = await axios.get(textSearchUrl, {
          params: {
            query: 'french toast OR avocado toast restaurant',
            location: `${lat},${lng}`,
            radius: radius,
            type: 'restaurant|cafe|bakery',
            key: process.env.GOOGLE_PLACES_API_KEY
          }
        });
        
        console.log('Google Places response:', response.data.status);
        
        if (response.data.results && response.data.results.length > 0) {
          const places = response.data.results.map(place => ({
            place_id: place.place_id,
            name: place.name,
            address: place.formatted_address || place.vicinity,
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
            rating: place.rating || null,
            price_level: place.price_level || null,
            category: 'restaurant',
            source: 'google_places',
            confidence: place.name.toLowerCase().includes('toast') ? 'high' : 'medium'
          }));
          
          return res.json(places);
        }
      } catch (googleError) {
        console.error('Google Places API error:', googleError.response?.data || googleError.message);
      }
    } else {
      console.log('No Google API key, using OpenStreetMap...');
    }
    
    // Fallback to Overpass API (OpenStreetMap)
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"="restaurant"](around:${radius},${lat},${lng});
        node["amenity"="cafe"](around:${radius},${lat},${lng});
        node["shop"="bakery"](around:${radius},${lat},${lng});
        node["amenity"="fast_food"]["cuisine"~"breakfast"](around:${radius},${lat},${lng});
      );
      out body;
    `;
    
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    
    try {
      console.log('Calling Overpass API...');
      const response = await axios.post(overpassUrl, `data=${encodeURIComponent(overpassQuery)}`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000 // 10 second timeout
      });
      
      console.log('Overpass response elements:', response.data.elements?.length || 0);
      
      const places = response.data.elements
        .filter(place => place.tags && place.tags.name)
        .map(place => ({
          place_id: `osm_${place.id}`,
          name: place.tags.name,
          address: [
            place.tags['addr:housenumber'],
            place.tags['addr:street'],
            place.tags['addr:city']
          ].filter(Boolean).join(' ') || 'Address not available',
          latitude: place.lat,
          longitude: place.lon,
          category: place.tags.amenity || place.tags.shop,
          cuisine: place.tags.cuisine,
          opening_hours: place.tags.opening_hours,
          source: 'openstreetmap',
          confidence: 'low'
        }));
      
      // Sort by likely to serve toast
      const sortedPlaces = places.sort((a, b) => {
        const toastLikely = ['cafe', 'bakery', 'breakfast'];
        const aScore = toastLikely.some(cat => 
          a.category?.includes(cat) || a.cuisine?.includes(cat) || a.name.toLowerCase().includes(cat)
        ) ? 1 : 0;
        const bScore = toastLikely.some(cat => 
          b.category?.includes(cat) || b.cuisine?.includes(cat) || b.name.toLowerCase().includes(cat)
        ) ? 1 : 0;
        return bScore - aScore;
      });
      
      res.json(sortedPlaces.slice(0, 20));
    } catch (apiError) {
      console.error('Overpass API error:', apiError.message);
      console.error('Error details:', apiError.response?.data || apiError.code);
      
      // Return mock data as last resort
      res.json([
        {
          place_id: 'mock_1',
          name: 'The Breakfast Club',
          address: '123 Toast Lane',
          latitude: parseFloat(lat) + 0.01,
          longitude: parseFloat(lng) + 0.01,
          category: 'restaurant',
          source: 'mock',
          confidence: 'low'
        }
      ]);
    }
  } catch (error) {
    console.error('Error searching places:', error);
    res.status(500).json({ error: 'Failed to search places' });
  }
});

// Seed data endpoint
app.post('/api/seed', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    
    const seedRestaurants = [
      { place_id: 'seed_1', name: 'Toast & Jam Café', address: '100 Breakfast Blvd', latitude: parseFloat(lat) + 0.005, longitude: parseFloat(lng) + 0.005 },
      { place_id: 'seed_2', name: 'The Golden Toast', address: '200 Butter Lane', latitude: parseFloat(lat) - 0.005, longitude: parseFloat(lng) + 0.005 },
      { place_id: 'seed_3', name: 'Morning Glory Diner', address: '300 Sunrise Ave', latitude: parseFloat(lat) + 0.005, longitude: parseFloat(lng) - 0.005 },
      { place_id: 'seed_4', name: 'Crispy Corner', address: '400 Crunch St', latitude: parseFloat(lat) - 0.005, longitude: parseFloat(lng) - 0.005 }
    ];
    
    let added = 0;
    
    for (const seedRestaurant of seedRestaurants) {
      try {
        await addRestaurant(seedRestaurant);
        added++;
      } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          console.log(`Seed restaurant already exists: ${seedRestaurant.name}`);
        } else {
          console.error(`Failed to add seed restaurant:`, err);
        }
      }
    }
    
    res.json({ message: `Seeded ${added} restaurants with toast! 🍞` });
  } catch (error) {
    console.error('Error seeding data:', error);
    res.status(500).json({ error: 'Failed to seed data' });
  }
});

// Migration endpoint (one-time use)
app.post('/api/migrate', async (req, res) => {
  try {
    await migrateFromJSON();
    res.json({ message: 'Migration completed successfully!' });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Migration failed' });
  }
});

// Initialize database and start server
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`LocalToast backend running on http://localhost:${PORT} 🍞`);
      console.log('Database: SQLite');
      
      // Offer to migrate on first run
      console.log('\nIf you have existing JSON data, run:');
      console.log(`curl -X POST http://localhost:${PORT}/api/migrate`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });