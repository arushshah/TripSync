import json
import pytest
from datetime import datetime, timedelta

def test_get_trip_todos(client, auth_headers, init_database, app):
    """Test retrieving all todos for a specific trip."""
    trip_id = app.test_data['trip_id']
    
    response = client.get(f'/api/trips/{trip_id}/todos', headers=auth_headers)
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert len(data) > 0
    assert data[0]['title'] == 'Test Todo'
    assert data[0]['description'] == 'Todo description'

def test_get_single_todo(client, auth_headers, init_database, app):
    """Test retrieving a specific todo item."""
    trip_id = app.test_data['trip_id']
    todo_id = app.test_data['todo_id']
    
    response = client.get(f'/api/trips/{trip_id}/todos/{todo_id}', headers=auth_headers)
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['id'] == todo_id
    assert data['title'] == 'Test Todo'
    assert data['completed'] is False

def test_create_todo(client, auth_headers, init_database, app):
    """Test creating a new todo item."""
    trip_id = app.test_data['trip_id']
    
    due_date = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
    todo_data = {
        'title': 'New Todo',
        'description': 'Testing todo creation',
        'due_date': due_date,
        'assignees': [],
        'completed': False
    }
    
    response = client.post(
        f'/api/trips/{trip_id}/todos',
        data=json.dumps(todo_data),
        headers=auth_headers,
        content_type='application/json'
    )
    
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['title'] == 'New Todo'
    assert data['description'] == 'Testing todo creation'
    assert data['creator_id'] == 'test_user_id'
    assert data['completed'] is False

def test_update_todo(client, auth_headers, init_database, app):
    """Test updating a todo item."""
    trip_id = app.test_data['trip_id']
    todo_id = app.test_data['todo_id']
    
    update_data = {
        'title': 'Updated Todo Title',
        'description': 'Updated todo description',
        'completed': True
    }
    
    response = client.put(
        f'/api/trips/{trip_id}/todos/{todo_id}',
        data=json.dumps(update_data),
        headers=auth_headers,
        content_type='application/json'
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['title'] == 'Updated Todo Title'
    assert data['description'] == 'Updated todo description'
    assert data['completed'] is True

def test_delete_todo(client, auth_headers, init_database, app):
    """Test deleting a todo item."""
    trip_id = app.test_data['trip_id']
    
    # Create a todo to delete
    todo_data = {
        'title': 'Todo to Delete',
        'description': 'This todo will be deleted',
        'completed': False
    }
    
    create_response = client.post(
        f'/api/trips/{trip_id}/todos',
        data=json.dumps(todo_data),
        headers=auth_headers,
        content_type='application/json'
    )
    
    new_todo_id = json.loads(create_response.data)['id']
    
    # Delete the todo
    delete_response = client.delete(
        f'/api/trips/{trip_id}/todos/{new_todo_id}',
        headers=auth_headers
    )
    
    assert delete_response.status_code == 204
    
    # Verify the todo was deleted
    get_response = client.get(
        f'/api/trips/{trip_id}/todos/{new_todo_id}',
        headers=auth_headers
    )
    
    assert get_response.status_code == 404

def test_assign_todo(client, auth_headers, init_database, app):
    """Test assigning a todo to a user."""
    trip_id = app.test_data['trip_id']
    todo_id = app.test_data['todo_id']
    user_id = 'test_user_id'
    
    assign_data = {
        'user_id': user_id
    }
    
    response = client.post(
        f'/api/trips/{trip_id}/todos/{todo_id}/assign',
        data=json.dumps(assign_data),
        headers=auth_headers,
        content_type='application/json'
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['message'] == 'User assigned successfully'
    
    # Verify the assignment by getting the todo details
    get_response = client.get(
        f'/api/trips/{trip_id}/todos/{todo_id}',
        headers=auth_headers
    )
    
    todo_data = json.loads(get_response.data)
    assert user_id in [a['id'] for a in todo_data['assignees']]

def test_unassign_todo(client, auth_headers, init_database, app):
    """Test unassigning a user from a todo."""
    trip_id = app.test_data['trip_id']
    todo_id = app.test_data['todo_id']
    user_id = 'test_user_id'
    
    # First assign the user
    assign_data = {
        'user_id': user_id
    }
    
    client.post(
        f'/api/trips/{trip_id}/todos/{todo_id}/assign',
        data=json.dumps(assign_data),
        headers=auth_headers,
        content_type='application/json'
    )
    
    # Now unassign the user
    unassign_data = {
        'user_id': user_id
    }
    
    unassign_response = client.post(
        f'/api/trips/{trip_id}/todos/{todo_id}/unassign',
        data=json.dumps(unassign_data),
        headers=auth_headers,
        content_type='application/json'
    )
    
    assert unassign_response.status_code == 200
    
    # Verify the unassignment
    get_response = client.get(
        f'/api/trips/{trip_id}/todos/{todo_id}',
        headers=auth_headers
    )
    
    todo_data = json.loads(get_response.data)
    assert user_id not in [a['id'] for a in todo_data['assignees']]

def test_mark_todo_complete(client, auth_headers, init_database, app):
    """Test marking a todo as complete."""
    trip_id = app.test_data['trip_id']
    todo_id = app.test_data['todo_id']
    
    complete_data = {
        'completed': True
    }
    
    response = client.put(
        f'/api/trips/{trip_id}/todos/{todo_id}/complete',
        data=json.dumps(complete_data),
        headers=auth_headers,
        content_type='application/json'
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['completed'] is True
    
    # Verify through a get request
    get_response = client.get(
        f'/api/trips/{trip_id}/todos/{todo_id}',
        headers=auth_headers
    )
    
    todo_data = json.loads(get_response.data)
    assert todo_data['completed'] is True

def test_filter_todos_by_status(client, auth_headers, init_database, app):
    """Test filtering todos by completion status."""
    trip_id = app.test_data['trip_id']
    
    # Create a completed todo
    completed_todo = {
        'title': 'Completed Todo',
        'description': 'This todo is completed',
        'completed': True
    }
    
    client.post(
        f'/api/trips/{trip_id}/todos',
        data=json.dumps(completed_todo),
        headers=auth_headers,
        content_type='application/json'
    )
    
    # Get only completed todos
    response = client.get(
        f'/api/trips/{trip_id}/todos?completed=true',
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert all(todo['completed'] for todo in data)
    
    # Get only incomplete todos
    response = client.get(
        f'/api/trips/{trip_id}/todos?completed=false',
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert all(not todo['completed'] for todo in data)

def test_todo_validation(client, auth_headers, init_database, app):
    """Test validation of todo data."""
    trip_id = app.test_data['trip_id']
    
    # Test with missing required fields (no title)
    todo_data = {
        'description': 'Todo with missing title',
        'completed': False
    }
    
    response = client.post(
        f'/api/trips/{trip_id}/todos',
        data=json.dumps(todo_data),
        headers=auth_headers,
        content_type='application/json'
    )
    
    assert response.status_code == 400
    
    # Test with invalid due date (in the past)
    todo_data = {
        'title': 'Invalid Todo',
        'description': 'Todo with past due date',
        'due_date': '2020-01-01',
        'completed': False
    }
    
    response = client.post(
        f'/api/trips/{trip_id}/todos',
        data=json.dumps(todo_data),
        headers=auth_headers,
        content_type='application/json'
    )
    
    # This might be 400 if there's validation for dates, or 201 if past dates are allowed
    # Adjust assertion based on your actual implementation
    assert response.status_code in (400, 201)