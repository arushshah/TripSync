import json
from unittest.mock import patch
import pytest

@pytest.fixture(autouse=True)
def mock_firebase_verify_id_token():
    with patch('firebase_admin.auth.verify_id_token') as mock_verify:
        mock_verify.return_value = {
            'uid': 'firebase_uid1',
            'phone_number': '+11234567890'
        }
        yield mock_verify

@pytest.fixture
def custom_mock_verify_token(mock_firebase_verify_id_token):
    mock_firebase_verify_id_token.return_value = {
        'uid': 'not_exist',
        'phone_number': '+1234567890'
    }

def test_health_check(client):
    """Test the health check endpoint."""
    response = client.get('/api/health')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['status'] == 'healthy'

def test_404_error(client):
    """Test that non-existent routes return 404."""
    headers = {
        'Authorization': 'Bearer test_token',
        'Content-Type': 'application/json'
    }
    response = client.get('/api/non_existent_route', headers=headers)
    
    # Should return 404 for a path that doesn't exist
    assert response.status_code == 404

def test_unauthorized_access(client):
    """Test that protected routes require authentication."""
    # Try accessing a protected endpoint without auth headers
    response = client.get('/api/trips')
    assert response.status_code == 401
    
    # Invalid auth token
    auth_headers = {
        'Content-Type': 'application/json'
    }
    response = client.get('/api/trips', headers=auth_headers)
    assert response.status_code == 401

def test_json_error_handling(client):
    headers = {
        'Authorization': 'Bearer test_token',
        'Content-Type': 'application/json'
    }
    response = client.post('/api/trips', data='{invalid JSON}', headers=headers)
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'error' in data