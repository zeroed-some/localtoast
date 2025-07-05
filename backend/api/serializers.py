from rest_framework import serializers
from .models import Restaurant, Rating


class RatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rating
        fields = ['id', 'rating', 'review', 'created_at']
        read_only_fields = ['id', 'created_at']
    
    def validate_review(self, value):
        """Ensure review mentions toast"""
        if value:
            toast_keywords = [
                'toast', 'bread', 'butter', 'jam', 'marmalade', 
                'french toast', 'avocado', 'sourdough', 'rye', 
                'whole wheat', 'brioche', 'challah'
            ]
            review_lower = value.lower()
            if not any(keyword in review_lower for keyword in toast_keywords):
                raise serializers.ValidationError(
                    'Reviews must be about toast! Please mention the toast in your review.'
                )
        return value


class RestaurantSerializer(serializers.ModelSerializer):
    average_rating = serializers.FloatField(read_only=True)
    total_ratings = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Restaurant
        fields = [
            'id', 'place_id', 'name', 'address', 
            'latitude', 'longitude', 'average_rating', 
            'total_ratings', 'created_at', 'has_toast'
        ]
        read_only_fields = ['id', 'average_rating', 'total_ratings', 'created_at']


class RestaurantDetailSerializer(RestaurantSerializer):
    """Detailed view including recent ratings"""
    recent_ratings = serializers.SerializerMethodField()
    
    class Meta(RestaurantSerializer.Meta):
        fields = RestaurantSerializer.Meta.fields + ['recent_ratings']
    
    def get_recent_ratings(self, obj):
        # Get last 5 ratings
        recent = obj.ratings.all()[:5]
        return RatingSerializer(recent, many=True).data


class CreateRatingSerializer(serializers.ModelSerializer):
    """Serializer for creating a rating"""
    class Meta:
        model = Rating
        fields = ['rating', 'review']
    
    def validate_review(self, value):
        """Ensure review mentions toast"""
        if value:
            toast_keywords = [
                'toast', 'bread', 'butter', 'jam', 'marmalade', 
                'french toast', 'avocado', 'sourdough', 'rye', 
                'whole wheat', 'brioche', 'challah'
            ]
            review_lower = value.lower()
            if not any(keyword in review_lower for keyword in toast_keywords):
                raise serializers.ValidationError(
                    'Reviews must be about toast! Please mention the toast in your review.'
                )
        return value


class PlaceSearchSerializer(serializers.Serializer):
    """Serializer for place search results"""
    place_id = serializers.CharField()
    name = serializers.CharField()
    address = serializers.CharField()
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    category = serializers.CharField(required=False)
    cuisine = serializers.CharField(required=False)
    confidence = serializers.CharField(required=False)
    distance = serializers.FloatField(required=False)
    source = serializers.CharField(required=False)
    restaurant_id = serializers.IntegerField(required=False)
    has_toast = serializers.BooleanField(required=False, allow_null=True)