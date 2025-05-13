import json
import pytest

def test_get_trip_itinerary(client, auth_headers, init_database, app):
    """Test retrieving a trip's itinerary."""
    trip_id = app.test_data['trip_id']
    
    response = client.get(f'/api/trips/{trip_id}/itinerary', headers=auth_headers)
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert len(data) > 0
    assert data[0]['title'] == 'Test Activity'
    assert data[0]['day'] == 1
    assert data[0]['start_time'] == '10:00'
    assert data[0]['end_time'] == '12:00'

def test_create_itinerary_item(client, auth_headers, init_database, app):
    """Test creating an itinerary item."""
    trip_id = app.test_data['trip_id']
    
    item_data = {
        'day': 2,
        'title': 'New Activity',
        'description': 'Day 2 activity',
        'start_time': '09:00',
        'end_time': '11:30',
        'location': 'New Location'
    }
    
    response = client.post(
        f'/api/trips/{trip_id}/itinerary',
        data=json.dumps(item_data),
        headers=auth_headers
    )
    
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['title'] == item_data['title']
    assert data['day'] == item_data['day']
    assert data['start_time'] == item_data['start_time']
    assert data['trip_id'] == trip_id
    
    # Store the item ID for later tests
    item_id = data['id']
    
    # Verify the item was created in the database
    get_response = client.get(
        f'/api/trips/{trip_id}/itinerary',
        headers=auth_headers
    )
    data = json.loads(get_response.data)
    assert any(item['id'] == item_id for item in data)

def test_update_itinerary_item(client, auth_headers, init_database, app):
    """Test updating an itinerary item."""
    trip_id = app.test_data['trip_id']
    
    # Get existing itinerary item
    get_response = client.get(
        f'/api/trips/{trip_id}/itinerary',
        headers=auth_headers
    )
    items = json.loads(get_response.data)
    item_id = items[0]['id']
    
    update_data = {
        'title': 'Updated Activity',
        'description': 'Updated description',
        'start_time': '11:00',
        'end_time': '13:00'
    }
    
    response = client.put(
        f'/api/trips/{trip_id}/itinerary/{item_id}',
        data=json.dumps(update_data),
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['title'] == update_data['title']
    assert data['description'] == update_data['description']
    assert data['start_time'] == update_data['start_time']
    assert data['end_time'] == update_data['end_time']
    # Day should remain unchanged
    assert data['day'] == items[0]['day']
    assert data['id'] == item_id

def test_delete_itinerary_item(client, auth_headers, init_database, app):
    """Test deleting an itinerary item."""
    trip_id = app.test_data['trip_id']
    
    # Create a new itinerary item to delete
    item_data = {
        'day': 3,
        'title': 'Activity to Delete',
        'description': 'Will be deleted',
        'start_time': '14:00',
        'end_time': '16:00',
        'location': 'Delete Location'
    }
    
    create_response = client.post(
        f'/api/trips/{trip_id}/itinerary',
        data=json.dumps(item_data),
        headers=auth_headers
    )
    
    item_id = json.loads(create_response.data)['id']
    
    # Delete the item
    delete_response = client.delete(
        f'/api/trips/{trip_id}/itinerary/{item_id}',
        headers=auth_headers
    )
    
    assert delete_response.status_code == 204
    
    # Verify the item was deleted
    get_response = client.get(
        f'/api/trips/{trip_id}/itinerary',
        headers=auth_headers
    )
    items = json.loads(get_response.data)
    assert not any(item['id'] == item_id for item in items)

def test_reorder_itinerary_items(client, auth_headers, init_database, app):
    """Test reordering itinerary items."""
    trip_id = app.test_data['trip_id']
    
    # Create multiple itinerary items
    for i in range(3):
        item_data = {
            'day': 4,
            'title': f'Activity {i+1}',
            'description': f'Day 4 activity {i+1}',
            'start_time': f'{10+i}:00',
            'end_time': f'{11+i}:00',
            'location': f'Location {i+1}'
        }
        client.post(
            f'/api/trips/{trip_id}/itinerary',
            data=json.dumps(item_data),
            headers=auth_headers
        )
    
    # Get all day 4 items
    get_response = client.get(
        f'/api/trips/{trip_id}/itinerary?day=4',
        headers=auth_headers
    )
    items = json.loads(get_response.data)
    item_ids = [item['id'] for item in items]
    
    # Reorder the items (reverse them)
    reorder_data = {
        'item_order': list(reversed(item_ids))
    }
    
    response = client.put(
        f'/api/trips/{trip_id}/itinerary/reorder',
        data=json.dumps(reorder_data),
        headers=auth_headers
    )
    
    assert response.status_code == 200
    
    # Verify the order was updated
    get_response = client.get(
        f'/api/trips/{trip_id}/itinerary?day=4',
        headers=auth_headers
    )
    updated_items = json.loads(get_response.data)
    updated_ids = [item['id'] for item in updated_items]
    
    # The order should be reversed
    assert updated_ids == reorder_data['item_order']

def test_filter_itinerary_by_day(client, auth_headers, init_database, app):
    """Test filtering itinerary items by day."""
    trip_id = app.test_data['trip_id']
    
    # Create items for different days
    for day in [5, 6]:
        item_data = {
            'day': day,
            'title': f'Day {day} Activity',
            'description': f'Activity for day {day}',
            'start_time': '10:00',
            'end_time': '12:00',
            'location': f'Location for day {day}'
        }
        client.post(
            f'/api/trips/{trip_id}/itinerary',
            data=json.dumps(item_data),
            headers=auth_headers
        )
    
    # Test filtering for day 5
    response = client.get(
        f'/api/trips/{trip_id}/itinerary?day=5',
        headers=auth_headers
    )
    
    assert response.status_code == 200
    items = json.loads(response.data)
    
    # All items should be for day 5
    assert all(item['day'] == 5 for item in items)
    assert any(item['title'] == 'Day 5 Activity' for item in items)

def test_non_trip_member_cannot_access_itinerary(client, auth_headers, init_database, app):
    """Test that non-trip members cannot access the itinerary."""
    trip_id = app.test_data['trip_id']
    
    # Create headers for a non-member user
    non_member_headers = {
        'Authorization': 'Bearer test_token',
        'Content-Type': 'application/json',
        'Firebase-UID': 'non_member_user_id'
    }
    
    response = client.get(
        f'/api/trips/{trip_id}/itinerary',
        headers=non_member_headers
    )
    
    assert response.status_code == 403  # Forbidden