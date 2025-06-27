const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file location
const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/data/localtoast.db'  // Railway persistent volume
  : path.join(__dirname, 'db', 'localtoast.db');

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database at:', DB_PATH);
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Initialize database schema
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create restaurants table
      db.run(`
        CREATE TABLE IF NOT EXISTS restaurants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          place_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          address TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('Error creating restaurants table:', err);
      });

      // Create ratings table
      db.run(`
        CREATE TABLE IF NOT EXISTS ratings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          restaurant_id INTEGER NOT NULL,
          rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
          review TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
        )
      `, (err) => {
        if (err) console.error('Error creating ratings table:', err);
      });

      // Create indexes for better performance
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_restaurants_location 
        ON restaurants(latitude, longitude)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_ratings_restaurant 
        ON ratings(restaurant_id)
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Database initialized successfully');
          resolve();
        }
      });
    });
  });
}

// Database helper functions
const dbHelpers = {
  // Get all restaurants with ratings
  getAllRestaurants: () => {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          r.*,
          AVG(rt.rating) as average_rating,
          COUNT(rt.id) as total_ratings
        FROM restaurants r
        LEFT JOIN ratings rt ON r.id = rt.restaurant_id
        GROUP BY r.id
      `;
      
      db.all(query, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  // Get restaurants within radius
  getNearbyRestaurants: (lat, lng, radiusKm = 5) => {
    return new Promise((resolve, reject) => {
      // SQLite doesn't have built-in geospatial functions, so we'll use a bounding box
      // This is an approximation but works well for small distances
      const latDiff = radiusKm / 111; // 1 degree latitude ≈ 111 km
      const lngDiff = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
      
      const query = `
        SELECT 
          r.*,
          AVG(rt.rating) as average_rating,
          COUNT(rt.id) as total_ratings
        FROM restaurants r
        LEFT JOIN ratings rt ON r.id = rt.restaurant_id
        WHERE 
          r.latitude BETWEEN ? AND ?
          AND r.longitude BETWEEN ? AND ?
        GROUP BY r.id
      `;
      
      db.all(query, [
        lat - latDiff, lat + latDiff,
        lng - lngDiff, lng + lngDiff
      ], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  // Get restaurant by place_id
  getRestaurantByPlaceId: (placeId) => {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM restaurants WHERE place_id = ?',
        [placeId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  },

  // Add new restaurant
  addRestaurant: (restaurant) => {
    return new Promise((resolve, reject) => {
      const { place_id, name, address, latitude, longitude } = restaurant;
      
      db.run(
        `INSERT INTO restaurants (place_id, name, address, latitude, longitude)
         VALUES (?, ?, ?, ?, ?)`,
        [place_id, name, address, latitude, longitude],
        function(err) {
          if (err) {
            reject(err);
          } else {
            // Get the inserted restaurant
            db.get(
              'SELECT * FROM restaurants WHERE id = ?',
              [this.lastID],
              (err, row) => {
                if (err) reject(err);
                else resolve(row);
              }
            );
          }
        }
      );
    });
  },

  // Add rating
  addRating: (restaurantId, rating, review) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO ratings (restaurant_id, rating, review)
         VALUES (?, ?, ?)`,
        [restaurantId, rating, review],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ 
              id: this.lastID, 
              message: 'Toast rating added successfully! 🍞' 
            });
          }
        }
      );
    });
  },

  // Get ratings for a restaurant
  getRestaurantRatings: (restaurantId) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM ratings 
         WHERE restaurant_id = ? 
         ORDER BY created_at DESC`,
        [restaurantId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  },

  // Migrate from JSON files (one-time migration)
  migrateFromJSON: async () => {
    const fs = require('fs').promises;
    const oldRestaurantsPath = path.join(__dirname, 'db', 'restaurants.json');
    const oldRatingsPath = path.join(__dirname, 'db', 'ratings.json');
    
    try {
      // Check if JSON files exist
      const restaurantsData = await fs.readFile(oldRestaurantsPath, 'utf8').catch(() => '[]');
      const ratingsData = await fs.readFile(oldRatingsPath, 'utf8').catch(() => '[]');
      
      const restaurants = JSON.parse(restaurantsData);
      const ratings = JSON.parse(ratingsData);
      
      console.log(`Migrating ${restaurants.length} restaurants and ${ratings.length} ratings...`);
      
      // Migrate restaurants
      for (const restaurant of restaurants) {
        try {
          await dbHelpers.addRestaurant(restaurant);
          console.log(`Migrated restaurant: ${restaurant.name}`);
        } catch (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            console.log(`Restaurant already exists: ${restaurant.name}`);
          } else {
            console.error(`Failed to migrate restaurant ${restaurant.name}:`, err);
          }
        }
      }
      
      // Migrate ratings
      for (const rating of ratings) {
        try {
          await dbHelpers.addRating(rating.restaurant_id, rating.rating, rating.review);
          console.log(`Migrated rating for restaurant ${rating.restaurant_id}`);
        } catch (err) {
          console.error(`Failed to migrate rating:`, err);
        }
      }
      
      console.log('Migration completed!');
      
      // Rename old files to .backup
      await fs.rename(oldRestaurantsPath, oldRestaurantsPath + '.backup').catch(() => {});
      await fs.rename(oldRatingsPath, oldRatingsPath + '.backup').catch(() => {});
      
    } catch (error) {
      console.error('Migration error:', error);
    }
  }
};

module.exports = {
  db,
  initializeDatabase,
  ...dbHelpers
};