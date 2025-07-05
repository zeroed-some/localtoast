'use client';

import { useState } from 'react';
import { X, Star, Loader2 } from 'lucide-react';
import { Restaurant, CreateRatingData } from '@/lib/api';

interface ReviewModalProps {
  restaurant: Restaurant;
  onClose: () => void;
  onSubmit: (data: CreateRatingData) => Promise<void>;
}

export default function ReviewModal({ restaurant, onClose, onSubmit }: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!review.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ rating, review });
      onClose();
    } catch (error) {
      // Error handling done in parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000] p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Rate the Toast at {restaurant.name} 🍞</h2>
            <p className="text-sm text-gray-600 mt-1">{restaurant.address}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">How was the toast?</label>
            <div className="flex space-x-2 justify-center">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className={`p-2 transition-colors ${rating >= value ? 'text-yellow-500' : 'text-gray-300'}`}
                >
                  <Star className="w-8 h-8 fill-current" />
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-gray-600 mt-2">
              {rating === 1 && "Terrible toast 😞"}
              {rating === 2 && "Not great toast 😕"}
              {rating === 3 && "Decent toast 🙂"}
              {rating === 4 && "Good toast! 😊"}
              {rating === 5 && "Amazing toast! 🤩"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Tell us about the toast (must mention toast!)
            </label>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              rows={4}
              placeholder="How was the toast? Was it crispy? Buttery? What kind of bread? Any toppings?"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              💡 Tip: Mention the toast texture, toppings, bread type, or how it was served!
            </p>
          </div>

          <div className="flex space-x-2">
            <button
              type="submit"
              disabled={isSubmitting || !review.trim()}
              className="flex-1 bg-amber-600 text-white py-2 px-4 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Toast Review</span>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}