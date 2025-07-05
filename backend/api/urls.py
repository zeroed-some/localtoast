from django.urls import path
from . import views

urlpatterns = [
    # Health check
    path('health/', views.health_check, name='health_check'),
    
    # Restaurant endpoints
    path('restaurants/', views.RestaurantListCreateView.as_view(), name='restaurant_list_create'),
    path('restaurants/nearby/', views.NearbyRestaurantsView.as_view(), name='restaurants_nearby'),
    path('restaurants/<int:pk>/', views.RestaurantDetailView.as_view(), name='restaurant_detail'),
    path('restaurants/<int:pk>/ratings/', views.RestaurantRatingView.as_view(), name='restaurant_ratings'),
    path('restaurants/<int:pk>/toast-status/', views.RestaurantToastStatusView.as_view(), name='restaurant_toast_status'),
    
    # Search
    path('search/places/', views.SearchPlacesView.as_view(), name='search_places'),
    
    # Utility
    path('seed/', views.seed_data, name='seed_data'),
]