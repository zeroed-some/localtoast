'use client';

import { useEffect, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Star, ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';
import { Restaurant } from '@/lib/api';

// Fix for default markers in React-Leaflet
interface LeafletIconDefault extends L.Icon.Default {
  _getIconUrl?: string;
}

if (typeof window !== 'undefined') {
  const iconDefault = L.Icon.Default.prototype as LeafletIconDefault;
  delete iconDefault._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/leaflet/marker-icon-2x.png',
    iconUrl: '/leaflet/marker-icon.png',
    shadowUrl: '/leaflet/marker-shadow.png',
  });
}

interface MapProps {
  center: { lat: number; lng: number };
  restaurants: Restaurant[];
  onRestaurantClick: (restaurant: Restaurant) => void;
  onToastStatusUpdate: (restaurantId: number, hasToast: boolean) => void;
}

// Component to recenter map when location changes
function RecenterMap({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], 13);
  }, [center, map]);
  return null;
}

export default function Map({ center, restaurants, onRestaurantClick, onToastStatusUpdate }: MapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-full w-full bg-gray-100 animate-pulse" />;
  }

  // Create icons based on toast status
  const createRestaurantIcon = (hasToast: boolean | null) => {
    let iconContent = '';
    let bgColor = '';
    
    if (hasToast === null) {
      // Unknown status - gray question mark
      iconContent = '❓';
      bgColor = '#9CA3AF'; // gray-400
    } else if (hasToast) {
      // Has toast - green toast
      iconContent = '🍞';
      bgColor = '#10B981'; // green-500
    } else {
      // No toast - red X
      iconContent = '❌';
      bgColor = '#EF4444'; // red-500
    }

    return new L.Icon({
      iconUrl: 'data:image/svg+xml,' +
        encodeURIComponent(`
        <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="18" fill="${bgColor}" stroke="#374151" stroke-width="2"/>
          <text x="20" y="27" text-anchor="middle" font-size="20">${iconContent}</text>
        </svg>
      `),
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40],
    });
  };

  const userIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml,' +
      encodeURIComponent(`
      <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
        <circle cx="15" cy="15" r="10" fill="#3B82F6" stroke="#1E40AF" stroke-width="2"/>
        <circle cx="15" cy="15" r="4" fill="white"/>
      </svg>
    `),
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        className="h-full w-full"
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
            icon={createRestaurantIcon(restaurant.has_toast)}
          >
            <Popup>
              <div className="p-2 min-w-[250px]">
                <h3 className="font-bold text-base mb-1">{restaurant.name}</h3>
                <p className="text-sm text-gray-700 mb-2">{restaurant.address}</p>
                
                {/* Toast status */}
                <div className="mb-3 p-2 bg-gray-50 rounded">
                  <p className="text-sm font-medium mb-2">
                    {restaurant.has_toast === null && "🤔 Does this place have toast?"}
                    {restaurant.has_toast === true && "✅ This place serves toast!"}
                    {restaurant.has_toast === false && "❌ No toast here"}
                  </p>
                  
                  {/* Toast voting buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToastStatusUpdate(restaurant.id, true);
                      }}
                      className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition ${
                        restaurant.has_toast === true
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 hover:bg-green-100 text-gray-700'
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      <span>Has Toast</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToastStatusUpdate(restaurant.id, false);
                      }}
                      className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition ${
                        restaurant.has_toast === false
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-200 hover:bg-red-100 text-gray-700'
                      }`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                      <span>No Toast</span>
                    </button>
                  </div>
                </div>
                
                {/* Rating info */}
                {restaurant.average_rating ? (
                  <p className="text-sm font-semibold flex items-center mb-2">
                    <Star className="w-4 h-4 text-yellow-500 fill-current mr-1" />
                    {restaurant.average_rating.toFixed(1)} ({restaurant.total_ratings} ratings)
                  </p>
                ) : (
                  <p className="text-sm text-gray-600 mb-2">No ratings yet</p>
                )}
                
                {/* Review button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestaurantClick(restaurant);
                  }}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Write Toast Review</span>
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}