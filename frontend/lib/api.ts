import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Create axios instance with default config
export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface Restaurant {
  id: number;
  place_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  average_rating: number | null;
  total_ratings: number;
  created_at: string;
  has_toast: boolean | null;
  distance?: number;
}

export interface Rating {
  id: number;
  rating: number;
  review: string;
  created_at: string;
}

export interface RestaurantDetail extends Restaurant {
  recent_ratings: Rating[];
}

export interface PlaceSearchResult {
  place_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category?: string;
  cuisine?: string;
  confidence?: string;
  distance?: number;
  source?: string;
  restaurant_id?: number;
  has_toast?: boolean | null;
}

export interface CreateRatingData {
  rating: number;
  review: string;
}

// API functions
export const restaurantApi = {
  // Get nearby restaurants
  getNearby: async (lat: number, lng: number, radius: number = 5) => {
    const response = await api.get<Restaurant[]>('/restaurants/nearby/', {
      params: { lat, lng, radius }
    });
    return response.data;
  },

  // Get restaurant details
  getById: async (id: number) => {
    const response = await api.get<RestaurantDetail>(`/restaurants/${id}/`);
    return response.data;
  },

  // Create restaurant
  create: async (data: Omit<Restaurant, 'id' | 'average_rating' | 'total_ratings' | 'created_at'>) => {
    const response = await api.post<Restaurant>('/restaurants/', data);
    return response.data;
  },

  // Add rating
  addRating: async (restaurantId: number, data: CreateRatingData) => {
    const response = await api.post(`/restaurants/${restaurantId}/ratings/`, data);
    return response.data;
  },

  // Update toast status
  updateToastStatus: async (restaurantId: number, hasToast: boolean) => {
    const response = await api.patch(`/restaurants/${restaurantId}/toast-status/`, { has_toast: hasToast });
    return response.data;
  },

  // Search places - FIXED to handle 404 with data
  searchPlaces: async (lat: number, lng: number, radius: number = 1000) => {
    try {
      const response = await api.get<PlaceSearchResult[]>('/search/places/', {
        params: { lat, lng, radius }
      });
      return response.data;
    } catch (error: any) {
      // Handle the bizarre 404-with-data issue from Railway
      if (error.response?.status === 404 && Array.isArray(error.response?.data)) {
        console.warn('Got 404 with valid data - returning data anyway');
        return error.response.data;
      }
      throw error;
    }
  },

  // Seed data
  seedData: async (lat: number, lng: number) => {
    const response = await api.post('/seed/', { lat, lng });
    return response.data;
  }
};