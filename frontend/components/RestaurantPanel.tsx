'use client';

import { useState } from 'react';
import { X, Star, MapPin } from 'lucide-react';
import { Restaurant, CreateRatingData } from '@/lib/api';

interface RestaurantPanelProps {
  restaurant: Restaurant;
  onClose: () => void;
  onAddRating: (data: CreateRatingData) => Promise<void>;
}

export default function RestaurantPanel({ restaurant, onClose, onAddRating }: RestaurantPanelProps) {
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!review.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddRating({ rating, review });
      setShowRatingForm(false);
      setRating(5);
      setReview('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white p-6 shadow-xl rounded-t-xl max-h-96 overflow-y-auto z-[1000] slide-up">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">{restaurant.name}</h2>
          <p className="text-gray-700 flex items-center mt-1">
            <MapPin className="w-4 h-4 mr-1" />
            {restaurant.address}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 p-1"
          aria-label="Close panel"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex items-center space-x-4 mb-4">
        <div className="flex items-center">
          {restaurant.average_rating ? (
            <>
              <Star className="w-5 h-5 text-yellow-500 fill-current" />
              <span className="ml-1 font-semibold text-gray-900">
                {restaurant.average_rating.toFixed(1)}
              </span>
            </>
          ) : (
            <span className="text-gray-700">No ratings yet</span>
          )}
        </div>
        <span className="text-gray-700">
          {restaurant.total_ratings} {restaurant.total_ratings === 1 ? 'rating' : 'ratings'}
        </span>
        {restaurant.distance && (
          <span className="text-gray-700">
            • {restaurant.distance < 1 ? `${Math.round(restaurant.distance * 1000)}m` : `${restaurant.distance.toFixed(1)}km`} away
          </span>
        )}
      </div>

      {!showRatingForm ? (
        <button
          onClick={() => setShowRatingForm(true)}
          className="w-full bg-amber-600 text-white py-2 px-4 rounded-lg hover:bg-amber-700 transition font-medium"
        >
          Rate the Toast! 🍞
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Rating</label>
            <div className="flex space-x-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
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
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              rows={3}
              placeholder="How was the toast? Crispy? Buttery? Perfect golden brown?"
              required
            />
          </div>

          <div className="flex space-x-2">
            <button
              type="submit"
              disabled={isSubmitting || !review.trim()}
              className="flex-1 bg-amber-600 text-white py-2 px-4 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Rating'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRatingForm(false);
                setRating(5);
                setReview('');
              }}
              className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}