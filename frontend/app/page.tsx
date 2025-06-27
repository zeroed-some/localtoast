'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Star, Plus, Loader2 } from 'lucide-react';
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';

// Dynamic import for Leaflet to avoid SSR issues
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-100 animate-pulse" />
});

const queryClient = new QueryClient();
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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

interface UserLocation {
  lat: number;
  lng: number;
}

function HomePage() {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [showAddRating, setShowAddRating] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingPlaceId, setAddingPlaceId] = useState<string | null>(null);

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
          console.error('Error getting location:', error.message || 'Location access denied');
          // Default to a location (NYC)
          setUserLocation({ lat: 40.7128, lng: -74.0060 });
        }
      );
    }
  }, []);

  // Fetch nearby restaurants
  const { data: restaurants, isLoading, refetch } = useQuery({
    queryKey: ['restaurants', userLocation],
    queryFn: async () => {
      if (!userLocation) return [];
      const response = await axios.get(`${API_URL}/api/restaurants/nearby`, {
        params: {
          lat: userLocation.lat,
          lng: userLocation.lng
        }
      });
      return response.data;
    },
    enabled: !!userLocation
  });

  // Add rating mutation
  const addRatingMutation = useMutation({
    mutationFn: async ({ restaurantId, rating, review }: { restaurantId: number, rating: number, review: string }) => {
      const response = await axios.post(`${API_URL}/api/restaurants/${restaurantId}/ratings`, {
        rating,
        review
      });
      return response.data;
    },
    onSuccess: () => {
      refetch();
      setShowAddRating(false);
      setRating(5);
      setReview('');
      alert('Toast rating added! 🍞');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to add rating');
    }
  });

  // Handle rating from map popup
  const handleMapRating = async (restaurantId: number, rating: number, review: string) => {
    try {
      await axios.post(`${API_URL}/api/restaurants/${restaurantId}/ratings`, {
        rating,
        review
      });
      
      // Refresh the restaurants list to update ratings
      await refetch();
      
      // Close any open panels
      setSelectedRestaurant(null);
      
      // Show success (could use a toast notification library here)
      console.log('Toast rating added! 🍞');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add rating');
      throw error; // Re-throw so popup knows it failed
    }
  };

  // Search for nearby places
  const searchNearbyPlaces = async () => {
    if (!userLocation) return;
    
    setIsSearching(true);
    try {
      const response = await axios.get(`${API_URL}/api/search/places`, {
        params: {
          lat: userLocation.lat,
          lng: userLocation.lng,
          radius: 2000 // 2km radius
        }
      });
      
      // Calculate distances and sort by closest
      const placesWithDistance = response.data.map((place: any) => {
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          place.latitude,
          place.longitude
        );
        return { ...place, distance };
      });
      
      // Sort by distance (closest first)
      placesWithDistance.sort((a: any, b: any) => a.distance - b.distance);
      
      setSearchResults(placesWithDistance);
      setShowSearch(true);
    } catch (error) {
      console.error('Error searching places:', error);
      alert('Failed to search for nearby places');
    } finally {
      setIsSearching(false);
    }
  };

  // Calculate distance between two points in kilometers
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Add a place from search results
  const addPlace = async (place: any) => {
    setAddingPlaceId(place.place_id);
    try {
      const response = await axios.post(`${API_URL}/api/restaurants`, {
        place_id: place.place_id,
        name: place.name,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude
      });
      
      // Refresh the restaurants list
      await refetch();
      
      // Remove the added place from search results
      setSearchResults(prev => prev.filter(p => p.place_id !== place.place_id));
      
      // If no more results, close the panel
      if (searchResults.length <= 1) {
        setShowSearch(false);
      }
    } catch (error) {
      console.error('Error adding place:', error);
      alert('Failed to add place');
    } finally {
      setAddingPlaceId(null);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-amber-600 text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🍞</span>
            <h1 className="text-2xl font-bold">LocalToast</h1>
          </div>
          <div className="flex items-center space-x-4">
            <p className="text-sm hidden sm:block">Find and rate the best toast in town!</p>
            <button
              onClick={searchNearbyPlaces}
              disabled={!userLocation || isSearching}
              className="bg-amber-700 hover:bg-amber-800 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center space-x-2"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>find toast</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 relative">
        {userLocation ? (
          <>
            <Map
              center={userLocation}
              restaurants={restaurants || []}
              searchResults={showSearch ? searchResults : []}
              onRestaurantClick={setSelectedRestaurant}
              onAddPlace={addPlace}
              onRateRestaurant={handleMapRating}
            />
            
            {/* Restaurant Details Panel */}
            {selectedRestaurant && !showSearch && (
              <div className="absolute bottom-0 left-0 right-0 bg-white p-6 shadow-xl rounded-t-xl max-h-96 overflow-y-auto z-[1000]">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedRestaurant.name}</h2>
                    <p className="text-gray-700">{selectedRestaurant.address}</p>
                  </div>
                  <button
                    onClick={() => setSelectedRestaurant(null)}
                    className="text-gray-700 hover:text-gray-900"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex items-center">
                    {selectedRestaurant.average_rating ? (
                      <>
                        <Star className="w-5 h-5 text-yellow-500 fill-current" />
                        <span className="ml-1 font-semibold text-gray-900">
                          {selectedRestaurant.average_rating.toFixed(1)}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-700">No ratings yet</span>
                    )}
                  </div>
                  <span className="text-gray-700">
                    {selectedRestaurant.total_ratings} {selectedRestaurant.total_ratings === 1 ? 'rating' : 'ratings'}
                  </span>
                </div>

                {!showAddRating ? (
                  <button
                    onClick={() => setShowAddRating(true)}
                    className="w-full bg-amber-600 text-white py-2 px-4 rounded-lg hover:bg-amber-700 transition"
                  >
                    Rate the Toast! 🍞
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Rating</label>
                      <div className="flex space-x-2">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            key={value}
                            onClick={() => setRating(value)}
                            className={`p-2 ${rating >= value ? 'text-yellow-500' : 'text-gray-300'}`}
                          >
                            <Star className="w-8 h-8 fill-current" />
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Review (must be about toast!)
                      </label>
                      <textarea
                        value={review}
                        onChange={(e) => setReview(e.target.value)}
                        className="w-full p-2 border rounded-lg"
                        rows={3}
                        placeholder="How was the toast? Crispy? Buttery? Perfect golden brown?"
                      />
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={handleAddRating}
                        disabled={addRatingMutation.isPending}
                        className="flex-1 bg-amber-600 text-white py-2 px-4 rounded-lg hover:bg-amber-700 transition disabled:opacity-50"
                      >
                        {addRatingMutation.isPending ? 'Submitting...' : 'Submit Rating'}
                      </button>
                      <button
                        onClick={() => {
                          setShowAddRating(false);
                          setRating(5);
                          setReview('');
                        }}
                        className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Search Results Panel */}
            {showSearch && (
              <div className="absolute bottom-0 left-0 right-0 bg-white p-6 shadow-xl rounded-t-xl max-h-96 overflow-y-auto z-[1000]">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-black">Nearby Places That Might Serve Toast 🍞</h2>
                  <button
                    onClick={() => setShowSearch(false)}
                    className="text-black hover:bg-gray-100 p-2 rounded-lg transition"
                    aria-label="Close search results"
                  >
                    ✕
                  </button>
                </div>
                
                <p className="text-base font-semibold text-black mb-4">
                  Found {searchResults.length} places nearby. Cafes, bakeries, and breakfast spots are shown first!
                </p>
                
                {searchResults.length === 0 ? (
                  <p className="text-center text-black font-medium py-8">
                    No places found nearby. Try moving the map to a different area.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {searchResults.map((place) => (
                      <div key={place.place_id} className="border-2 border-gray-300 rounded-lg p-4 hover:bg-amber-50 transition-colors">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-black text-black">{place.name}</h3>
                            <p className="text-base font-normal text-black mt-1">{place.address}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <span className="text-sm font-bold text-black uppercase bg-gray-100 px-2 py-1 rounded">
                                {place.category}
                              </span>
                              {place.cuisine && (
                                <span className="text-sm font-bold text-black bg-gray-100 px-2 py-1 rounded">
                                  {place.cuisine}
                                </span>
                              )}
                              {place.distance && (
                                <span className="text-sm font-black text-black bg-amber-100 px-2 py-1 rounded">
                                  📍 {place.distance < 1 
                                    ? `${Math.round(place.distance * 1000)}m`
                                    : `${place.distance.toFixed(1)}km`
                                  }
                                </span>
                              )}
                            </div>
                            {place.confidence && (
                              <span className={`inline-block mt-2 px-3 py-1.5 rounded text-sm font-black ${
                                place.confidence === 'high' ? 'bg-green-600 text-white' :
                                place.confidence === 'medium' ? 'bg-yellow-500 text-black' :
                                'bg-gray-600 text-white'
                              }`}>
                                {place.confidence === 'high' ? '🍞 LIKELY HAS TOAST!' :
                                 place.confidence === 'medium' ? '🤔 MIGHT HAVE TOAST' :
                                 '❓ CHECK MENU'}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => addPlace(place)}
                            disabled={addingPlaceId === place.place_id}
                            className={`${
                              addingPlaceId === place.place_id 
                                ? 'bg-green-600 text-white' 
                                : 'bg-black hover:bg-gray-800 text-white'
                            } px-5 py-2.5 rounded-md text-base font-bold transition shadow-md hover:shadow-lg min-w-[80px] disabled:cursor-not-allowed`}
                            aria-label={`Add ${place.name} to LocalToast`}
                          >
                            {addingPlaceId === place.place_id ? '✓' : 'Add'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-amber-600" />
              <p>Getting your location...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>
  );
}