import json
from flask import g
from unittest.mock import patch


@patch('firebase_admin.auth.verify_id_token')
def test_create_user(mock_verify_token, client, auth_headers):
    """Test user creation."""
    mock_verify_token.return_value = {
        'uid': 'firebase_uid1',
        'phone_number': '+1234567890'
    }
    new_user_data = {
        'uid': 'firebase_testid',
        'first_name': 'Test',
        'last_name': 'User',
        'phone_number': '+19876543210',
        'photo_url': 'https://example.com/photo3.jpg'
    }
    
    response = client.post(
        '/api/users/register', 
        data=json.dumps(new_user_data),
        headers=auth_headers
    )
    
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['firebase_uid'] == new_user_data['uid']
    assert data['first_name'] == new_user_data['first_name']
    assert data['last_name'] == new_user_data['last_name']
    assert data['phone_number'] == new_user_data['phone_number']
    
    # Verify the user was created in the database
    get_response = client.get(
        f'/api/users/{data["id"]}',
        headers=auth_headers
    )
    assert get_response.status_code == 200

@patch('firebase_admin.auth.verify_id_token')
def test_get_current_user(mock_verify_token, client, auth_headers):
    """Test getting the current user profile."""
    mock_verify_token.return_value = {
        'uid': 'firebase_uid1',
        'phone_number': '+1234567890'
    }
    response = client.get('/api/users/1', headers=auth_headers)
    assert response.status_code == 200
    
    data = json.loads(response.data)
    assert data['firebase_uid'] == 'firebase_uid1'
    assert data['id'] == '1'
    assert data['first_name'] == 'John'
    assert data['last_name'] == 'Doe'
    assert data['phone_number'] == '+11234567890'

@patch('firebase_admin.auth.verify_id_token')
def test_update_user(mock_verify_token, client, auth_headers):
    """Test updating a user profile."""
    mock_verify_token.return_value = {
        'uid': 'firebase_uid1',
        'phone_number': '+1234567890'
    }
    update_data = {
        'first_name': 'New',
        'last_name': 'User',
        'profile_photo': 'https://example.com/new_photo.jpg'
    }
    
    response = client.put(
        '/api/users/profile', 
        data=json.dumps(update_data),
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['first_name'] == update_data['first_name']
    assert data['last_name'] == update_data['last_name']
    assert data['profile_photo'] == update_data['profile_photo']
    # Phone number should remain unchanged
    assert data['phone_number'] == '+11234567890'

@patch('firebase_admin.auth.verify_id_token')
def test_get_nonexistent_user(mock_verify_token, client, auth_headers):
    """Test getting a user that does not exist."""
    mock_verify_token.return_value = {
        'uid': 'firebase_uid1',
        'phone_number': '+11234567890'
    }
    response = client.get('/api/users/nonexistent_id', headers=auth_headers)
    assert response.status_code == 404

@patch('firebase_admin.auth.verify_id_token')
def test_check_user_phone(mock_verify_token, client, auth_headers):
    """Test getting trips for a user."""
    mock_verify_token.return_value = {
        'uid': 'firebase_uid1',
        'phone_number': '+11234567890'
    }

    response = client.post('/api/users/check-phone', data=json.dumps({'phone_number': '+11234567890'}), headers=auth_headers)
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['exists'] is True