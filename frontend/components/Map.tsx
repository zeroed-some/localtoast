'use client';

import { useEffect, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Star } from 'lucide-react';

// Fix for default markers in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

interface Restaurant {
  id: number;
  place_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  average_rating: number | null;
  total_ratings: number;
}

interface MapProps {
  center: { lat: number; lng: number };
  restaurants: Restaurant[];
  searchResults?: any[];
  onRestaurantClick: (restaurant: Restaurant) => void;
  onAddPlace?: (place: any) => void;
  onRateRestaurant?: (restaurantId: number, rating: number, review: string) => void;
}

// Component to recenter map when location changes
function RecenterMap({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView([center.lat, center.lng], 13);
  }, [center, map]);
  
  return null;
}

// Custom toast icon - using URL encoding to handle emoji
const toastIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(`
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="#F59E0B" stroke="#92400E" stroke-width="2"/>
      <text x="20" y="27" text-anchor="middle" font-size="24">🍞</text>
    </svg>
  `),
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

// User location icon
const userIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(`
    <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
      <circle cx="15" cy="15" r="10" fill="#3B82F6" stroke="#1E40AF" stroke-width="2"/>
      <circle cx="15" cy="15" r="4" fill="white"/>
    </svg>
  `),
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// Search result icon (gray/tentative)
const searchResultIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(`
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="#9CA3AF" stroke="#4B5563" stroke-width="2" stroke-dasharray="5,5"/>
      <text x="20" y="27" text-anchor="middle" font-size="20">❓</text>
    </svg>
  `),
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

// Restaurant popup with rating functionality
function RestaurantPopup({ restaurant, onRate }: { restaurant: Restaurant; onRate?: (id: number, rating: number, review: string) => void }) {
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    console.log('Submitting rating:', { restaurantId: restaurant.id, rating, review });
    if (!onRate || !review.trim()) {
      console.log('Cannot submit: onRate missing or no review');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onRate(restaurant.id, rating, review);
      setShowRating(false);
      setRating(5);
      setReview('');
    } catch (error) {
      console.error('Rating submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-3 min-w-[250px]">
      <h3 className="font-bold text-base mb-1">{restaurant.name}</h3>
      <p className="text-sm text-gray-700 mb-2">{restaurant.address}</p>
      
      {restaurant.average_rating ? (
        <p className="text-sm font-semibold mb-3 flex items-center">
          <Star className="w-4 h-4 text-yellow-500 fill-current mr-1" />
          {restaurant.average_rating.toFixed(1)} ({restaurant.total_ratings} {restaurant.total_ratings === 1 ? 'rating' : 'ratings'})
        </p>
      ) : (
        <p className="text-sm text-gray-600 mb-3">No ratings yet</p>
      )}
      
      {!showRating ? (
        <button
          onClick={() => setShowRating(true)}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded font-bold text-sm transition"
        >
          Rate the Toast! 🍞
        </button>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold mb-1">Rating</label>
            <div className="flex gap-1 justify-center">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  onClick={() => setRating(value)}
                  className={`p-1 ${rating >= value ? 'text-yellow-500' : 'text-gray-300'}`}
                >
                  <Star className="w-6 h-6 fill-current" />
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold mb-1">
              Review (must mention toast!)
            </label>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              className="w-full p-2 border rounded text-sm"
              rows={2}
              placeholder="How was the toast?"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !review.trim()}
              className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white px-2 py-1 rounded font-bold text-sm transition"
            >
              {isSubmitting ? '...' : 'Submit'}
            </button>
            <button
              onClick={() => {
                setShowRating(false);
                setRating(5);
                setReview('');
              }}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded font-bold text-sm transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Map({ center, restaurants, searchResults = [], onRestaurantClick, onAddPlace, onRateRestaurant }: MapProps) {
  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          tileSize={256}
          maxZoom={19}
        />
        
        <RecenterMap center={center} />
        
        {/* User location marker */}
        <Marker position={[center.lat, center.lng]} icon={userIcon}>
          <Popup>
            <div className="text-center">
              <p className="font-semibold">You are here!</p>
              <p className="text-sm text-gray-600">Ready to find some toast? 🍞</p>
            </div>
          </Popup>
        </Marker>
        
        {/* Restaurant markers */}
        {restaurants.map((restaurant) => (
          <Marker
            key={restaurant.id}
            position={[restaurant.latitude, restaurant.longitude]}
            icon={toastIcon}
            eventHandlers={{
              click: () => onRestaurantClick(restaurant),
            }}
          >
            <Popup maxWidth={300} closeButton={true} closeOnClick={false} autoClose={false}>
              <RestaurantPopup restaurant={restaurant} onRate={onRateRestaurant} />
            </Popup>
          </Marker>
        ))}
        
        {/* Search result markers (temporary) */}
        {searchResults.map((place) => (
          <Marker
            key={`search-${place.place_id}`}
            position={[place.latitude, place.longitude]}
            icon={searchResultIcon}
          >
            <Popup>
              <div className="p-3">
                <h3 className="font-bold text-base mb-1">{place.name}</h3>
                <p className="text-sm text-gray-700 mb-2">{place.address}</p>
                {place.confidence && (
                  <p className="text-xs font-semibold mb-3">
                    {place.confidence === 'high' ? '🍞 Likely has toast!' :
                     place.confidence === 'medium' ? '🤔 Might have toast' :
                     '❓ Check menu'}
                  </p>
                )}
                {onAddPlace && (
                  <button
                    onClick={() => onAddPlace(place)}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded font-bold text-sm transition"
                  >
                    Add to LocalToast 🍞
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}