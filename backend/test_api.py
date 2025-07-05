#!/usr/bin/env python
"""
Quick script to test the LocalToast API endpoints
Run from backend directory: python test_api.py
"""
import requests
import json

BASE_URL = "http://localhost:8000/api"

# Test location (NYC)
TEST_LAT = 40.7128
TEST_LNG = -74.0060

def test_health():
    """Test health endpoint"""
    print("🏥 Testing health check...")
    response = requests.get(f"{BASE_URL}/health/")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}\n")

def test_seed():
    """Seed some data"""
    print("🌱 Seeding data...")
    response = requests.post(f"{BASE_URL}/seed/", json={
        "lat": TEST_LAT,
        "lng": TEST_LNG
    })
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}\n")

def test_nearby():
    """Test nearby restaurants"""
    print("📍 Testing nearby restaurants...")
    response = requests.get(f"{BASE_URL}/restaurants/nearby/", params={
        "lat": TEST_LAT,
        "lng": TEST_LNG,
        "radius": 5
    })
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Found {len(data)} restaurants")
    if data:
        print(f"First restaurant: {data[0]['name']} ({data[0]['distance']}km away)\n")

def test_add_rating():
    """Test adding a rating"""
    print("⭐ Testing rating system...")
    # First get a restaurant
    response = requests.get(f"{BASE_URL}/restaurants/")
    restaurants = response.json()
    
    if restaurants:
        restaurant_id = restaurants[0]['id']
        rating_data = {
            "rating": 5,
            "review": "The french toast here is absolutely amazing! Crispy on the outside, fluffy inside."
        }
        response = requests.post(
            f"{BASE_URL}/restaurants/{restaurant_id}/ratings/",
            json=rating_data
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}\n")

def test_search():
    """Test place search"""
    print("🔍 Testing place search...")
    response = requests.get(f"{BASE_URL}/search/places/", params={
        "lat": TEST_LAT,
        "lng": TEST_LNG,
        "radius": 1000
    })
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Found {len(data)} places")
    if data:
        print(f"First place: {data[0]['name']} (confidence: {data[0].get('confidence', 'unknown')})\n")

if __name__ == "__main__":
    print("🍞 LocalToast API Test Suite\n")
    
    test_health()
    test_seed()
    test_nearby()
    test_add_rating()
    test_search()
    
    print("✅ All tests complete!")