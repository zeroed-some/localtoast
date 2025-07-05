from django.http import JsonResponse
from django.utils import timezone
from django.conf import settings
from django.db.models import Q
from rest_framework import status, generics
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView
import requests
import math
from .models import Restaurant, Rating
from .serializers import (
    RestaurantSerializer, RestaurantDetailSerializer,
    CreateRatingSerializer, RatingSerializer, PlaceSearchSerializer
)


def health_check(request):
    """Simple health check endpoint"""
    return JsonResponse({
        'status': 'LocalToast is cooking! 🍞',
        'timestamp': timezone.now().isoformat(),
        'version': '2.0'
    })


def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in kilometers"""
    R = 6371  # Radius of Earth in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat/2) * math.sin(dlat/2) +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon/2) * math.sin(dlon/2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c


class NearbyRestaurantsView(APIView):
    """Get restaurants near a location"""
    
    def get(self, request):
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')
        radius = float(request.query_params.get('radius', 5))  # km
        
        if not lat or not lng:
            return Response(
                {'error': 'Latitude and longitude are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            lat = float(lat)
            lng = float(lng)
        except ValueError:
            return Response(
                {'error': 'Invalid latitude or longitude'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Simple bounding box calculation
        lat_diff = radius / 111  # 1 degree latitude ≈ 111 km
        lng_diff = radius / (111 * math.cos(math.radians(lat)))
        
        restaurants = Restaurant.objects.filter(
            latitude__range=(lat - lat_diff, lat + lat_diff),
            longitude__range=(lng - lng_diff, lng + lng_diff)
        )
        
        # Calculate actual distances and filter
        results = []
        for restaurant in restaurants:
            distance = calculate_distance(
                lat, lng, 
                restaurant.latitude, 
                restaurant.longitude
            )
            if distance <= radius:
                serializer = RestaurantSerializer(restaurant)
                data = serializer.data
                data['distance'] = round(distance, 2)
                results.append(data)
        
        # Sort by distance
        results.sort(key=lambda x: x['distance'])
        
        return Response(results)


class RestaurantListCreateView(generics.ListCreateAPIView):
    """List all restaurants or create a new one"""
    queryset = Restaurant.objects.all()
    serializer_class = RestaurantSerializer
    
    def create(self, request, *args, **kwargs):
        # Check if restaurant already exists
        place_id = request.data.get('place_id')
        if place_id:
            existing = Restaurant.objects.filter(place_id=place_id).first()
            if existing:
                serializer = self.get_serializer(existing)
                return Response(serializer.data, status=status.HTTP_200_OK)
        
        return super().create(request, *args, **kwargs)


class RestaurantDetailView(generics.RetrieveAPIView):
    """Get detailed info about a restaurant"""
    queryset = Restaurant.objects.all()
    serializer_class = RestaurantDetailSerializer


class RestaurantRatingView(APIView):
    """Add a rating to a restaurant or get all ratings"""
    
    def get(self, request, pk):
        try:
            restaurant = Restaurant.objects.get(pk=pk)
        except Restaurant.DoesNotExist:
            return Response(
                {'error': 'Restaurant not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        ratings = restaurant.ratings.all()
        serializer = RatingSerializer(ratings, many=True)
        return Response(serializer.data)
    
    def post(self, request, pk):
        try:
            restaurant = Restaurant.objects.get(pk=pk)
        except Restaurant.DoesNotExist:
            return Response(
                {'error': 'Restaurant not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = CreateRatingSerializer(data=request.data)
        if serializer.is_valid():
            rating = serializer.save(restaurant=restaurant)
            return Response(
                {
                    'id': rating.id,
                    'message': 'Toast rating added successfully! 🍞'
                },
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RestaurantToastStatusView(APIView):
    """Update restaurant's toast status"""
    
    def patch(self, request, pk):
        try:
            restaurant = Restaurant.objects.get(pk=pk)
        except Restaurant.DoesNotExist:
            return Response(
                {'error': 'Restaurant not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        has_toast = request.data.get('has_toast')
        if has_toast is None:
            return Response(
                {'error': 'has_toast field is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        restaurant.has_toast = has_toast
        restaurant.save()
        
        return Response({
            'id': restaurant.id,
            'has_toast': restaurant.has_toast,
            'message': f'Toast status updated! {"🍞" if has_toast else "❌"}'
        })


class SearchPlacesView(APIView):
    """Search for places that might serve toast"""
    
    def get(self, request):
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')
        radius = request.query_params.get('radius', '1000')
        
        if not lat or not lng:
            return Response(
                {'error': 'Latitude and longitude are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        places = []
        
        # Try Google Places API first if available
        if settings.GOOGLE_PLACES_API_KEY:
            try:
                google_results = self.search_google_places(lat, lng, radius)
                places.extend(google_results)
            except Exception as e:
                print(f"Google Places API error: {e}")
        
        # If no results from Google, try OpenStreetMap
        if not places:
            try:
                osm_results = self.search_openstreetmap(lat, lng, radius)
                places.extend(osm_results)
            except Exception as e:
                print(f"OpenStreetMap error: {e}")
        
        # If still no results, return mock data
        if not places:
            places = self.get_mock_places(float(lat), float(lng))
        
        # Calculate distances and sort
        user_lat, user_lng = float(lat), float(lng)
        for place in places:
            place['distance'] = calculate_distance(
                user_lat, user_lng,
                place['latitude'], place['longitude']
            )
        
        places.sort(key=lambda x: x['distance'])
        
        # Auto-create restaurants for all found places
        created_restaurants = []
        for place in places[:20]:  # Limit to top 20
            restaurant, created = Restaurant.objects.get_or_create(
                place_id=place['place_id'],
                defaults={
                    'name': place['name'],
                    'address': place['address'],
                    'latitude': place['latitude'],
                    'longitude': place['longitude'],
                    'has_toast': None  # Unknown status initially
                }
            )
            # Add restaurant data to place info
            place['restaurant_id'] = restaurant.id
            place['has_toast'] = restaurant.has_toast
            created_restaurants.append(place)
        
        serializer = PlaceSearchSerializer(created_restaurants, many=True)
        return Response(serializer.data)
    
    def search_google_places(self, lat, lng, radius):
        """Search using Google Places API"""
        url = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
        params = {
            'query': 'cafe bakery breakfast toast',
            'location': f'{lat},{lng}',
            'radius': radius,
            'type': 'restaurant|cafe|bakery',
            'key': settings.GOOGLE_PLACES_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        places = []
        for place in data.get('results', []):
            confidence = 'high' if 'toast' in place['name'].lower() else 'medium'
            if any(word in place['name'].lower() for word in ['cafe', 'bakery', 'breakfast']):
                confidence = 'high'
            
            places.append({
                'place_id': place['place_id'],
                'name': place['name'],
                'address': place.get('formatted_address', place.get('vicinity', '')),
                'latitude': place['geometry']['location']['lat'],
                'longitude': place['geometry']['location']['lng'],
                'category': 'restaurant',
                'confidence': confidence,
                'source': 'google_places'
            })
        
        return places
    
    def search_openstreetmap(self, lat, lng, radius):
        """Search using OpenStreetMap Overpass API"""
        overpass_query = f"""
            [out:json][timeout:25];
            (
                node["amenity"="cafe"](around:{radius},{lat},{lng});
                node["shop"="bakery"](around:{radius},{lat},{lng});
                node["amenity"="restaurant"]["cuisine"~"breakfast"](around:{radius},{lat},{lng});
            );
            out body;
        """
        
        url = 'https://overpass-api.de/api/interpreter'
        response = requests.post(
            url, 
            data={'data': overpass_query},
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        places = []
        for element in data.get('elements', []):
            if not element.get('tags', {}).get('name'):
                continue
            
            tags = element['tags']
            category = tags.get('amenity') or tags.get('shop', 'unknown')
            
            # Determine confidence
            confidence = 'low'
            if category in ['cafe', 'bakery']:
                confidence = 'medium'
            if 'breakfast' in tags.get('cuisine', '').lower():
                confidence = 'high'
            
            places.append({
                'place_id': f"osm_{element['id']}",
                'name': tags['name'],
                'address': self.format_osm_address(tags),
                'latitude': element['lat'],
                'longitude': element['lon'],
                'category': category,
                'cuisine': tags.get('cuisine', ''),
                'confidence': confidence,
                'source': 'openstreetmap'
            })
        
        return places
    
    def format_osm_address(self, tags):
        """Format address from OSM tags"""
        parts = []
        for key in ['addr:housenumber', 'addr:street', 'addr:city']:
            if key in tags:
                parts.append(tags[key])
        return ' '.join(parts) if parts else 'Address not available'
    
    def get_mock_places(self, lat, lng):
        """Return mock data as fallback"""
        return [
            {
                'place_id': 'mock_1',
                'name': 'The Breakfast Club',
                'address': '123 Toast Lane',
                'latitude': lat + 0.01,
                'longitude': lng + 0.01,
                'category': 'restaurant',
                'confidence': 'low',
                'source': 'mock'
            }
        ]


@api_view(['POST'])
def seed_data(request):
    """Seed the database with sample restaurants"""
    lat = float(request.data.get('lat', 40.7128))
    lng = float(request.data.get('lng', -74.0060))
    
    seed_restaurants = [
        {
            'place_id': 'seed_1',
            'name': 'Toast & Jam Café',
            'address': '100 Breakfast Blvd',
            'latitude': lat + 0.005,
            'longitude': lng + 0.005
        },
        {
            'place_id': 'seed_2',
            'name': 'The Golden Toast',
            'address': '200 Butter Lane',
            'latitude': lat - 0.005,
            'longitude': lng + 0.005
        },
        {
            'place_id': 'seed_3',
            'name': 'Morning Glory Diner',
            'address': '300 Sunrise Ave',
            'latitude': lat + 0.005,
            'longitude': lng - 0.005
        },
        {
            'place_id': 'seed_4',
            'name': 'Crispy Corner',
            'address': '400 Crunch St',
            'latitude': lat - 0.005,
            'longitude': lng - 0.005
        }
    ]
    
    created = 0
    for restaurant_data in seed_restaurants:
        restaurant, was_created = Restaurant.objects.get_or_create(
            place_id=restaurant_data['place_id'],
            defaults=restaurant_data
        )
        if was_created:
            created += 1
    
    return Response({
        'message': f'Seeded {created} restaurants with toast! 🍞',
        'total_restaurants': Restaurant.objects.count()
    })