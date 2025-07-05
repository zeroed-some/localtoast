'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Plus, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Providers } from './providers';
import { Loading } from '@/components/Loading';
import ReviewModal from '@/components/ReviewModal';
import SearchPanel from '@/components/SearchPanel';
import { restaurantApi, Restaurant, CreateRatingData, PlaceSearchResult } from '@/lib/api';

// Dynamic import for Map to avoid SSR issues
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-100 animate-pulse" />,
});

// Type for API errors
type ApiError = {
  response?: {
    data?: {
      error?: string;
    };
  };
};

function HomePage() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResultsMinimized, setSearchResultsMinimized] = useState(false);
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

  // Get user's location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          // Default to NYC
          setUserLocation({ lat: 40.7128, lng: -74.0060 });
        }
      );
    } else {
      setUserLocation({ lat: 40.7128, lng: -74.0060 });
    }
  }, []);

  // Add rating mutation
  const addRatingMutation = useMutation({
    mutationFn: ({ restaurantId, data }: { restaurantId: number; data: CreateRatingData }) =>
      restaurantApi.addRating(restaurantId, data),
    onSuccess: async () => {
      // Refresh restaurants list
      if (userLocation) {
        const updatedRestaurants = await restaurantApi.getNearby(userLocation.lat, userLocation.lng);
        setRestaurants(updatedRestaurants);
      }
      alert('Toast rating added! 🍞');
    },
    onError: (error: unknown) => {
      const apiError = error as ApiError;
      alert(apiError.response?.data?.error || 'Failed to add rating');
    },
  });

  // Search places mutation
  const searchMutation = useMutation({
    mutationFn: async () => {
      const searchPlaces = await restaurantApi.searchPlaces(userLocation!.lat, userLocation!.lng, 2000);
      
      // All places are now auto-created as restaurants, so fetch the updated list
      const updatedRestaurants = await restaurantApi.getNearby(userLocation!.lat, userLocation!.lng);
      setRestaurants(updatedRestaurants);
      
      return searchPlaces;
    },
    onSuccess: (data) => {
      setSearchResults(data);
      setShowSearchResults(true);
      setSelectedRestaurant(null); // Close any open restaurant panel
    },
    onError: (error: unknown) => {
      const apiError = error as ApiError;
      alert(apiError.response?.data?.error || 'Failed to search for places');
    },
  });

  // Update toast status mutation
  const updateToastStatusMutation = useMutation({
    mutationFn: ({ restaurantId, hasToast }: { restaurantId: number; hasToast: boolean }) =>
      restaurantApi.updateToastStatus(restaurantId, hasToast),
    onSuccess: async () => {
      // Refresh restaurants
      if (userLocation) {
        const updatedRestaurants = await restaurantApi.getNearby(userLocation.lat, userLocation.lng);
        setRestaurants(updatedRestaurants);
      }
    },
    onError: (error: unknown) => {
      const apiError = error as ApiError;
      alert(apiError.response?.data?.error || 'Failed to update toast status');
    },
  });

  const handleAddRating = async (data: CreateRatingData) => {
    if (!selectedRestaurant) return;
    await addRatingMutation.mutateAsync({ restaurantId: selectedRestaurant.id, data });
  };

  if (!userLocation) {
    return <Loading />;
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-amber-600 text-white p-4 shadow-lg relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🍞</span>
            <h1 className="text-2xl font-bold">LocalToast</h1>
          </div>
          <div className="flex items-center space-x-4">
            <p className="text-sm hidden sm:block">Find and rate the best toast in town!</p>
            <button
              onClick={() => searchMutation.mutate()}
              disabled={searchMutation.isPending}
              className="bg-amber-700 hover:bg-amber-800 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center space-x-2"
            >
              {searchMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>Find Toast</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 relative">
        <Map
          center={userLocation}
          restaurants={restaurants}
          onRestaurantClick={setSelectedRestaurant}
          onToastStatusUpdate={(restaurantId, hasToast) => 
            updateToastStatusMutation.mutate({ restaurantId, hasToast })
          }
        />

        {/* Loading indicator */}
        {searchMutation.isPending && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-md px-4 py-2 flex items-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            <span>Searching for toast spots...</span>
          </div>
        )}

        {/* Restaurant count - moved to top right */}
        {restaurants.length > 0 && !searchMutation.isPending && (
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md px-4 py-2">
            <p className="text-sm font-medium">
              {restaurants.length} toast spot{restaurants.length !== 1 ? 's' : ''} nearby 🍞
            </p>
          </div>
        )}

        {/* Review Modal */}
        {selectedRestaurant && (
          <ReviewModal
            restaurant={selectedRestaurant}
            onClose={() => setSelectedRestaurant(null)}
            onSubmit={handleAddRating}
          />
        )}

        {/* Search results panel */}
        {showSearchResults && (
          <>
            {searchResultsMinimized ? (
              // Minimized state - just a bar at the bottom
              <div className="absolute bottom-0 left-0 right-0 bg-white shadow-xl rounded-t-xl p-3 z-[1000] cursor-pointer"
                   onClick={() => setSearchResultsMinimized(false)}>
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium">
                    {searchResults.length} search results (click to expand)
                  </p>
                  <button className="text-gray-500 hover:text-gray-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              // Full search panel
              <SearchPanel
                searchResults={searchResults}
                onClose={() => setSearchResultsMinimized(true)}
                onToastStatusUpdate={(restaurantId, hasToast) => 
                  updateToastStatusMutation.mutate({ restaurantId, hasToast })
                }
                onRestaurantClick={(restaurantId) => {
                  const restaurant = restaurants.find(r => r.id === restaurantId);
                  if (restaurant) {
                    setSelectedRestaurant(restaurant);
                    // Don't minimize - let user continue browsing
                  }
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Providers>
      <HomePage />
    </Providers>
  );
}