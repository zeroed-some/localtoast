import { Loader2 } from 'lucide-react';

export function Loading() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-amber-600" />
        <p className="text-gray-600">Getting your location...</p>
      </div>
    </div>
  );
}