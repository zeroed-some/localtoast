'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, MapPin } from 'lucide-react';
import { PlaceSearchResult } from '@/lib/api';

interface SearchPanelProps {
  searchResults: PlaceSearchResult[];
  onClose: () => void;
  onToastStatusUpdate: (restaurantId: number, hasToast: boolean) => void;
  onRestaurantClick: (restaurantId: number) => void;
}

export default function SearchPanel({ 
  searchResults, 
  onClose, 
  onToastStatusUpdate,
  onRestaurantClick 
}: SearchPanelProps) {
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());

  const handleToastStatus = async (restaurantId: number, hasToast: boolean) => {
    setUpdatingIds(prev => new Set(prev).add(restaurantId));
    try {
      await onToastStatusUpdate(restaurantId, hasToast);
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(restaurantId);
        return next;
      });
    }
  };

  const getConfidenceColor = (confidence?: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceText = (confidence?: string) => {
    switch (confidence) {
      case 'high': return '🍞 Likely has toast!';
      case 'medium': return '🤔 Might have toast';
      default: return '❓ Check menu';
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white p-6 shadow-xl rounded-t-xl max-h-[40vh] overflow-y-auto z-[1000] slide-up">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Found {searchResults.length} Places That Might Serve Toast 🍞
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Help us map the toast! Vote if these places serve toast.
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition"
          aria-label="Minimize search results"
        >
          <span className="text-sm">Minimize</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {searchResults.length === 0 ? (
        <p className="text-center text-gray-600 py-8">
          No places found nearby. Try moving to a different area.
        </p>
      ) : (
        <div className="space-y-4">
          {searchResults.map((place) => (
            <div
              key={place.place_id}
              className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{place.name}</h3>
                  <p className="text-sm text-gray-600 mt-1 flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {place.address}
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {place.category && (
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {place.category}
                      </span>
                    )}
                    {place.distance && (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded font-medium">
                        {place.distance < 1 
                          ? `${Math.round(place.distance * 1000)}m away`
                          : `${place.distance.toFixed(1)}km away`
                        }
                      </span>
                    )}
                    {place.confidence && (
                      <span className={`text-xs px-2 py-1 rounded font-medium ${getConfidenceColor(place.confidence)}`}>
                        {getConfidenceText(place.confidence)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Toast status section */}
              <div className="mt-3 p-3 bg-gray-50 rounded">
                <p className="text-sm font-medium mb-2">
                  {place.has_toast === null && "🤔 Does this place have toast?"}
                  {place.has_toast === true && "✅ This place serves toast!"}
                  {place.has_toast === false && "❌ No toast here"}
                </p>
                
                {/* Toast voting buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => place.restaurant_id && handleToastStatus(place.restaurant_id, true)}
                    disabled={!place.restaurant_id || updatingIds.has(place.restaurant_id!)}
                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition ${
                      place.has_toast === true
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 hover:bg-green-100 text-gray-700'
                    } ${(!place.restaurant_id || updatingIds.has(place.restaurant_id!)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span>Has Toast</span>
                  </button>
                  <button
                    onClick={() => place.restaurant_id && handleToastStatus(place.restaurant_id, false)}
                    disabled={!place.restaurant_id || updatingIds.has(place.restaurant_id!)}
                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition ${
                      place.has_toast === false
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-200 hover:bg-red-100 text-gray-700'
                    } ${(!place.restaurant_id || updatingIds.has(place.restaurant_id!)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    <span>No Toast</span>
                  </button>
                </div>
                
                {/* Review button */}
                <button
                  onClick={() => place.restaurant_id && onRestaurantClick(place.restaurant_id)}
                  disabled={!place.restaurant_id}
                  className="w-full mt-2 bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Write Toast Review</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}