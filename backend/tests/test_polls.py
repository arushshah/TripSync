import json
import pytest
from datetime import datetime, timedelta

def test_get_trip_polls(client, auth_headers, init_database, app):
    """Test retrieving all polls for a specific trip."""
    trip_id = app.test_data['trip_id']
    
    response = client.get(f'/api/trips/{trip_id}/polls', headers=auth_headers)
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert len(data) > 0
    assert data[0]['title'] == 'Test Poll'
    assert data[0]['description'] == 'Poll description'

def test_get_single_poll(client, auth_headers, init_database, app):
    """Test retrieving a specific poll."""
    trip_id = app.test_data['trip_id']
    poll_id = app.test_data['poll_id']
    
    response = client.get(f'/api/trips/{trip_id}/polls/{poll_id}', headers=auth_headers)
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['id'] == poll_id
    assert data['title'] == 'Test Poll'
    assert data['options'] is not None
    assert len(data['options']) == 2
    assert data['options'][0]['text'] == 'Option 1'
    assert data['options'][1]['text'] == 'Option 2'

def test_create_poll(client, auth_headers, init_database, app):
    """Test creating a new poll."""
    trip_id = app.test_data['trip_id']
    
    end_date = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
    poll_data = {
        'title': 'New Poll',
        'description': 'Testing poll creation',
        'end_date': end_date,
        'options': ['Choice A', 'Choice B', 'Choice C']
    }
    
    response = client.post(
        f'/api/trips/{trip_id}/polls',
        data=json.dumps(poll_data),
        headers=auth_headers,
        content_type='application/json'
    )
    
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['title'] == 'New Poll'
    assert data['description'] == 'Testing poll creation'
    assert len(data['options']) == 3
    assert data['creator_id'] == 'test_user_id'

def test_update_poll(client, auth_headers, init_database, app):
    """Test updating a poll."""
    trip_id = app.test_data['trip_id']
    poll_id = app.test_data['poll_id']
    
    update_data = {
        'title': 'Updated Poll Title',
        'description': 'Updated poll description'
    }
    
    response = client.put(
        f'/api/trips/{trip_id}/polls/{poll_id}',
        data=json.dumps(update_data),
        headers=auth_headers,
        content_type='application/json'
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['title'] == 'Updated Poll Title'
    assert data['description'] == 'Updated poll description'

def test_delete_poll(client, auth_headers, init_database, app):
    """Test deleting a poll."""
    trip_id = app.test_data['trip_id']
    
    # Create a poll to delete
    end_date = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
    poll_data = {
        'title': 'Poll to Delete',
        'description': 'This poll will be deleted',
        'end_date': end_date,
        'options': ['Option X', 'Option Y']
    }
    
    create_response = client.post(
        f'/api/trips/{trip_id}/polls',
        data=json.dumps(poll_data),
        headers=auth_headers,
        content_type='application/json'
    )
    
    new_poll_id = json.loads(create_response.data)['id']
    
    # Delete the poll
    delete_response = client.delete(
        f'/api/trips/{trip_id}/polls/{new_poll_id}',
        headers=auth_headers
    )
    
    assert delete_response.status_code == 204
    
    # Verify the poll was deleted
    get_response = client.get(
        f'/api/trips/{trip_id}/polls/{new_poll_id}',
        headers=auth_headers
    )
    
    assert get_response.status_code == 404

def test_vote_on_poll(client, auth_headers, init_database, app):
    """Test voting on a poll option."""
    trip_id = app.test_data['trip_id']
    poll_id = app.test_data['poll_id']
    option_id = app.test_data['poll_option_id']
    
    vote_data = {
        'option_id': option_id
    }
    
    response = client.post(
        f'/api/trips/{trip_id}/polls/{poll_id}/vote',
        data=json.dumps(vote_data),
        headers=auth_headers,
        content_type='application/json'
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['message'] == 'Vote recorded successfully'
    
    # Verify the vote was recorded by getting the poll details
    get_response = client.get(
        f'/api/trips/{trip_id}/polls/{poll_id}',
        headers=auth_headers
    )
    
    poll_data = json.loads(get_response.data)
    voted_option = next((opt for opt in poll_data['options'] if opt['id'] == option_id), None)
    assert voted_option is not None
    assert voted_option['voter_count'] > 0
    assert 'test_user_id' in [v['id'] for v in voted_option['voters']]

def test_change_vote(client, auth_headers, init_database, app):
    """Test changing a vote from one option to another."""
    trip_id = app.test_data['trip_id']
    poll_id = app.test_data['poll_id']
    
    # First vote for option 1
    vote_data = {
        'option_id': app.test_data['poll_option_id']
    }
    
    client.post(
        f'/api/trips/{trip_id}/polls/{poll_id}/vote',
        data=json.dumps(vote_data),
        headers=auth_headers,
        content_type='application/json'
    )
    
    # Get option 2's ID
    get_response = client.get(
        f'/api/trips/{trip_id}/polls/{poll_id}',
        headers=auth_headers
    )
    
    poll_data = json.loads(get_response.data)
    option2_id = next((opt['id'] for opt in poll_data['options'] if opt['text'] == 'Option 2'), None)
    
    # Now change vote to option 2
    new_vote_data = {
        'option_id': option2_id
    }
    
    change_response = client.post(
        f'/api/trips/{trip_id}/polls/{poll_id}/vote',
        data=json.dumps(new_vote_data),
        headers=auth_headers,
        content_type='application/json'
    )
    
    assert change_response.status_code == 200
    
    # Verify the vote was changed
    get_updated_response = client.get(
        f'/api/trips/{trip_id}/polls/{poll_id}',
        headers=auth_headers
    )
    
    updated_poll_data = json.loads(get_updated_response.data)
    option1 = next((opt for opt in updated_poll_data['options'] if opt['text'] == 'Option 1'), None)
    option2 = next((opt for opt in updated_poll_data['options'] if opt['text'] == 'Option 2'), None)
    
    # Check if user is no longer in option 1 voters, but is in option 2 voters
    assert 'test_user_id' not in [v['id'] for v in option1['voters']]
    assert 'test_user_id' in [v['id'] for v in option2['voters']]

def test_poll_validation(client, auth_headers, init_database, app):
    """Test validation of poll data."""
    trip_id = app.test_data['trip_id']
    
    # Test with missing required fields (no title)
    poll_data = {
        'description': 'Poll with missing title',
        'end_date': '2025-06-01',
        'options': ['Option 1', 'Option 2']
    }
    
    response = client.post(
        f'/api/trips/{trip_id}/polls',
        data=json.dumps(poll_data),
        headers=auth_headers,
        content_type='application/json'
    )
    
    assert response.status_code == 400
    
    # Test with too few options
    poll_data = {
        'title': 'Invalid Poll',
        'description': 'Poll with too few options',
        'end_date': '2025-06-01',
        'options': [] # No options
    }
    
    response = client.post(
        f'/api/trips/{trip_id}/polls',
        data=json.dumps(poll_data),
        headers=auth_headers,
        content_type='application/json'
    )
    
    assert response.status_code == 400
    
    # Test with invalid end date (in the past)
    poll_data = {
        'title': 'Invalid Poll',
        'description': 'Poll with past end date',
        'end_date': '2020-01-01',
        'options': ['Option 1', 'Option 2']
    }
    
    response = client.post(
        f'/api/trips/{trip_id}/polls',
        data=json.dumps(poll_data),
        headers=auth_headers,
        content_type='application/json'
    )
    
    assert response.status_code == 400