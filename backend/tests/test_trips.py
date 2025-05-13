import json
import pytest

def test_create_trip(client, auth_headers):
    """Test creating a new trip."""
    trip_data = {
        'name': 'New Trip',
        'description': 'A new test trip',
        'location': 'New Location',
        'start_date': '2025-07-01',
        'end_date': '2025-07-07',
        'guest_limit': 5
    }
    
    response = client.post(
        '/api/trips', 
        data=json.dumps(trip_data),
        headers=auth_headers
    )
    
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['name'] == trip_data['name']
    assert data['description'] == trip_data['description']
    assert data['organizer_id'] == 'test_user_id'
    assert data['guest_limit'] == trip_data['guest_limit']
    
    # Store trip id for later use
    trip_id = data['id']
    
    # Verify the trip was created in the database
    get_response = client.get(f'/api/trips/{trip_id}', headers=auth_headers)
    assert get_response.status_code == 200

def test_get_trip(client, auth_headers, init_database, app):
    """Test getting a trip by ID."""
    trip_id = app.test_data['trip_id']
    
    response = client.get(f'/api/trips/{trip_id}', headers=auth_headers)
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['id'] == trip_id
    assert data['name'] == 'Test Trip'
    assert data['organizer_id'] == 'test_user_id'

def test_update_trip(client, auth_headers, init_database, app):
    """Test updating a trip."""
    trip_id = app.test_data['trip_id']
    
    update_data = {
        'name': 'Updated Trip',
        'description': 'Updated description',
        'location': 'Updated Location'
    }
    
    response = client.put(
        f'/api/trips/{trip_id}', 
        data=json.dumps(update_data),
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['name'] == update_data['name']
    assert data['description'] == update_data['description']
    assert data['location'] == update_data['location']
    # Other fields should remain unchanged
    assert data['start_date'] == '2025-06-01'

def test_delete_trip(client, auth_headers, init_database, app):
    """Test deleting a trip."""
    # Create a new trip to delete
    trip_data = {
        'name': 'Trip to Delete',
        'description': 'A trip that will be deleted',
        'location': 'Delete Location',
        'start_date': '2025-08-01',
        'end_date': '2025-08-07'
    }
    
    create_response = client.post(
        '/api/trips', 
        data=json.dumps(trip_data),
        headers=auth_headers
    )
    
    trip_id = json.loads(create_response.data)['id']
    
    # Delete the trip
    response = client.delete(f'/api/trips/{trip_id}', headers=auth_headers)
    assert response.status_code == 204
    
    # Verify the trip was deleted
    get_response = client.get(f'/api/trips/{trip_id}', headers=auth_headers)
    assert get_response.status_code == 404

def test_non_organizer_cannot_delete_trip(client, auth_headers, init_database, app):
    """Test that non-organizer cannot delete a trip."""
    trip_id = app.test_data['trip_id']
    
    # Create headers for another user
    non_organizer_headers = {
        'Authorization': 'Bearer test_token',
        'Content-Type': 'application/json',
        'Firebase-UID': 'test_user_id2'
    }
    
    response = client.delete(f'/api/trips/{trip_id}', headers=non_organizer_headers)
    assert response.status_code == 403  # Forbidden

def test_generate_invite_link(client, auth_headers, init_database, app):
    """Test generating an invite link for a trip."""
    trip_id = app.test_data['trip_id']
    
    response = client.post(f'/api/trips/{trip_id}/invite-link', headers=auth_headers)
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'invite_link' in data
    assert data['invite_link'] != ''

def test_trip_members(client, auth_headers, init_database, app):
    """Test getting trip members."""
    trip_id = app.test_data['trip_id']
    
    response = client.get(f'/api/trips/{trip_id}/members', headers=auth_headers)
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert len(data) == 2  # Trip organizer and added member
    assert any(member['id'] == 'test_user_id' for member in data)
    assert any(member['id'] == 'test_user_id2' for member in data)

def test_add_trip_member(client, auth_headers, init_database, app):
    """Test adding a member to a trip."""
    trip_id = app.test_data['trip_id']
    
    # Create a new user first
    new_user_data = {
        'id': 'new_member_id',
        'name': 'New Member',
        'phone_number': '+19998887777',
        'photo_url': 'https://example.com/photo_new.jpg'
    }
    
    client.post(
        '/api/users', 
        data=json.dumps(new_user_data),
        headers=auth_headers
    )
    
    # Add the new user to the trip
    member_data = {
        'user_id': 'new_member_id',
        'rsvp_status': 'going'
    }
    
    response = client.post(
        f'/api/trips/{trip_id}/members',
        data=json.dumps(member_data),
        headers=auth_headers
    )
    
    assert response.status_code == 201
    
    # Verify the member was added
    get_response = client.get(f'/api/trips/{trip_id}/members', headers=auth_headers)
    data = json.loads(get_response.data)
    assert len(data) == 3  # Now 3 members
    assert any(member['id'] == 'new_member_id' for member in data)

def test_update_rsvp_status(client, auth_headers, init_database, app):
    """Test updating RSVP status."""
    trip_id = app.test_data['trip_id']
    
    # Create headers for the second user
    user2_headers = {
        'Authorization': 'Bearer test_token',
        'Content-Type': 'application/json',
        'Firebase-UID': 'test_user_id2'
    }
    
    rsvp_data = {
        'rsvp_status': 'maybe'
    }
    
    response = client.put(
        f'/api/trips/{trip_id}/rsvp',
        data=json.dumps(rsvp_data),
        headers=user2_headers
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['rsvp_status'] == 'maybe'
    
    # Verify the RSVP status was updated
    get_response = client.get(f'/api/trips/{trip_id}/members', headers=auth_headers)
    members = json.loads(get_response.data)
    user2_member = next((m for m in members if m['id'] == 'test_user_id2'), None)
    assert user2_member['rsvp_status'] == 'maybe'

def test_trip_guest_limit(client, auth_headers, init_database):
    """Test trip guest limit functionality."""
    # Create a trip with a guest limit of 1
    trip_data = {
        'name': 'Limited Trip',
        'description': 'A trip with guest limit',
        'location': 'Limit Location',
        'start_date': '2025-09-01',
        'end_date': '2025-09-07',
        'guest_limit': 1
    }
    
    create_response = client.post(
        '/api/trips', 
        data=json.dumps(trip_data),
        headers=auth_headers
    )
    
    trip_id = json.loads(create_response.data)['id']
    
    # Try to add first member (should succeed)
    member1_data = {
        'user_id': 'test_user_id2',
        'rsvp_status': 'going'
    }
    
    response1 = client.post(
        f'/api/trips/{trip_id}/members',
        data=json.dumps(member1_data),
        headers=auth_headers
    )
    
    assert response1.status_code == 201
    
    # Create another user
    new_user_data = {
        'id': 'waitlist_user_id',
        'name': 'Waitlist User',
        'phone_number': '+17776665555',
        'photo_url': 'https://example.com/photo_waitlist.jpg'
    }
    
    client.post(
        '/api/users', 
        data=json.dumps(new_user_data),
        headers=auth_headers
    )
    
    # Try to add second member (should be placed on waitlist)
    member2_data = {
        'user_id': 'waitlist_user_id',
        'rsvp_status': 'going'
    }
    
    response2 = client.post(
        f'/api/trips/{trip_id}/members',
        data=json.dumps(member2_data),
        headers=auth_headers
    )
    
    assert response2.status_code == 201
    data = json.loads(response2.data)
    assert data['waitlist_position'] is not None
    assert data['waitlist_position'] > 0