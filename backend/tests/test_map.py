import json
import pytest
from flask import g

def test_get_map_markers(client, auth_headers, init_database, app):
    """Test retrieving all map markers for a trip."""
    trip_id = app.test_data['trip_id']
    response = client.get(f'/api/trips/{trip_id}/map', headers=auth_headers)
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'markers' in data
    assert isinstance(data['markers'], list)
    # There should be at least one marker from the test data
    assert len(data['markers']) >= 1

def test_get_map_markers_by_category(client, auth_headers, init_database, app):
    """Test retrieving map markers filtered by category."""
    trip_id = app.test_data['trip_id']
    # Using the category from the test data in conftest.py
    category = 'restaurant'
    response = client.get(f'/api/trips/{trip_id}/map?category={category}', headers=auth_headers)
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'markers' in data
    assert isinstance(data['markers'], list)
    for marker in data['markers']:
        assert marker['category'] == category

def test_create_map_marker(client, auth_headers, init_database, app):
    """Test creating a new map marker."""
    trip_id = app.test_data['trip_id']
    new_marker = {
        'name': 'New Test Marker',
        'category': 'attraction',
        'latitude': 40.7128,
        'longitude': -74.0060,
        'address': '123 Test Street, City, Country',
        'description': 'A fascinating place to visit',
        'website': 'https://testmarker.com',
        'phone': '+1234567890'
    }
    
    response = client.post(
        f'/api/trips/{trip_id}/map',
        data=json.dumps(new_marker),
        headers=auth_headers
    )
    
    assert response.status_code == 201
    data = json.loads(response.data)
    assert 'marker' in data
    assert data['marker']['name'] == new_marker['name']
    assert data['marker']['category'] == new_marker['category']
    assert 'id' in data['marker']

def test_create_map_marker_invalid_data(client, auth_headers, init_database, app):
    """Test creating a map marker with invalid data."""
    trip_id = app.test_data['trip_id']
    invalid_marker = {
        'name': 'Invalid Marker',
        # Missing required fields: latitude and longitude
        'category': 'attraction'
    }
    
    response = client.post(
        f'/api/trips/{trip_id}/map',
        data=json.dumps(invalid_marker),
        headers=auth_headers
    )
    
    assert response.status_code == 400

def test_get_specific_map_marker(client, auth_headers, init_database, app):
    """Test retrieving a specific map marker."""
    trip_id = app.test_data['trip_id']
    
    # First, get all markers to find one to test
    response = client.get(f'/api/trips/{trip_id}/map', headers=auth_headers)
    data = json.loads(response.data)
    assert len(data['markers']) > 0
    marker_id = data['markers'][0]['id']
    
    # Now get the specific marker
    response = client.get(f'/api/trips/{trip_id}/map/{marker_id}', headers=auth_headers)
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'marker' in data
    assert data['marker']['id'] == marker_id

def test_get_nonexistent_marker(client, auth_headers, init_database, app):
    """Test retrieving a non-existent map marker."""
    trip_id = app.test_data['trip_id']
    nonexistent_id = 9999  # Assuming this ID doesn't exist
    
    response = client.get(f'/api/trips/{trip_id}/map/{nonexistent_id}', headers=auth_headers)
    
    assert response.status_code == 404

def test_update_map_marker(client, auth_headers, init_database, app):
    """Test updating a map marker."""
    trip_id = app.test_data['trip_id']
    
    # First, get all markers to find one to update
    response = client.get(f'/api/trips/{trip_id}/map', headers=auth_headers)
    data = json.loads(response.data)
    assert len(data['markers']) > 0
    marker_id = data['markers'][0]['id']
    
    # Update the marker
    updated_data = {
        'name': 'Updated Marker Name',
        'description': 'Updated description'
    }
    
    response = client.put(
        f'/api/trips/{trip_id}/map/{marker_id}',
        data=json.dumps(updated_data),
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'marker' in data
    assert data['marker']['name'] == 'Updated Marker Name'
    assert data['marker']['description'] == 'Updated description'

def test_delete_map_marker(client, auth_headers, init_database, app):
    """Test deleting a map marker."""
    trip_id = app.test_data['trip_id']
    
    # Create a new marker to delete
    new_marker = {
        'name': 'Marker To Delete',
        'category': 'other',
        'latitude': 51.5074,
        'longitude': -0.1278,
    }
    
    response = client.post(
        f'/api/trips/{trip_id}/map',
        data=json.dumps(new_marker),
        headers=auth_headers
    )
    
    marker_id = json.loads(response.data)['marker']['id']
    
    # Now delete the marker
    response = client.delete(f'/api/trips/{trip_id}/map/{marker_id}', headers=auth_headers)
    
    assert response.status_code == 200
    
    # Verify it's been deleted
    response = client.get(f'/api/trips/{trip_id}/map/{marker_id}', headers=auth_headers)
    assert response.status_code == 404

def test_get_categories(client, auth_headers, init_database, app):
    """Test retrieving all unique categories in a trip."""
    trip_id = app.test_data['trip_id']
    response = client.get(f'/api/trips/{trip_id}/map/categories', headers=auth_headers)
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'categories' in data
    assert isinstance(data['categories'], list)
    # There should be at least one category from the test data
    assert len(data['categories']) >= 1

def test_unauthorized_access(client, init_database, app):
    """Test that unauthorized access is denied."""
    trip_id = app.test_data['trip_id']
    
    # Try to access without auth headers
    response = client.get(f'/api/trips/{trip_id}/map')
    assert response.status_code == 401

def test_access_to_nonmember_trip(client, auth_headers, init_database, app):
    """Test that access is denied for trips the user is not a member of."""
    # Assuming trip_id 9999 doesn't exist or the user is not a member
    nonmember_trip_id = 9999
    
    response = client.get(f'/api/trips/{nonmember_trip_id}/map', headers=auth_headers)
    # Should either be 403 (forbidden) or 404 (not found) depending on your implementation
    assert response.status_code in [403, 404]