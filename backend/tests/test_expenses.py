import json
import pytest
from decimal import Decimal

def test_get_trip_expenses(client, auth_headers, init_database, app):
    """Test retrieving a trip's expenses."""
    trip_id = app.test_data['trip_id']
    
    response = client.get(f'/api/trips/{trip_id}/expenses', headers=auth_headers)
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert len(data) > 0
    assert data[0]['description'] == 'Test Expense'
    assert float(data[0]['amount']) == 100.50
    assert data[0]['payer_id'] == 'test_user_id'

def test_create_expense(client, auth_headers, init_database, app):
    """Test creating an expense."""
    trip_id = app.test_data['trip_id']
    
    expense_data = {
        'amount': 75.25,
        'description': 'New Expense',
        'date': '2025-06-02',
        'category': 'food',
        'split_among': ['test_user_id', 'test_user_id2']
    }
    
    response = client.post(
        f'/api/trips/{trip_id}/expenses',
        data=json.dumps(expense_data),
        headers=auth_headers
    )
    
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['description'] == expense_data['description']
    assert float(data['amount']) == expense_data['amount']
    assert data['payer_id'] == 'test_user_id'  # From auth headers
    assert data['trip_id'] == trip_id
    
    # Verify participants were saved correctly
    assert 'participants' in data
    assert len(data['participants']) == 2

def test_update_expense(client, auth_headers, init_database, app):
    """Test updating an expense."""
    trip_id = app.test_data['trip_id']
    
    # First, get an existing expense
    get_response = client.get(
        f'/api/trips/{trip_id}/expenses',
        headers=auth_headers
    )
    expenses = json.loads(get_response.data)
    expense_id = expenses[0]['id']
    
    update_data = {
        'amount': 120.75,
        'description': 'Updated Expense',
        'category': 'transportation'
    }
    
    response = client.put(
        f'/api/trips/{trip_id}/expenses/{expense_id}',
        data=json.dumps(update_data),
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['description'] == update_data['description']
    assert float(data['amount']) == update_data['amount']
    assert data['category'] == update_data['category']
    # Date should remain unchanged
    assert data['date'] == expenses[0]['date']
    assert data['id'] == expense_id

def test_delete_expense(client, auth_headers, init_database, app):
    """Test deleting an expense."""
    trip_id = app.test_data['trip_id']
    
    # Create a new expense to delete
    expense_data = {
        'amount': 45.00,
        'description': 'Expense to Delete',
        'date': '2025-06-03',
        'category': 'entertainment'
    }
    
    create_response = client.post(
        f'/api/trips/{trip_id}/expenses',
        data=json.dumps(expense_data),
        headers=auth_headers
    )
    
    expense_id = json.loads(create_response.data)['id']
    
    # Delete the expense
    delete_response = client.delete(
        f'/api/trips/{trip_id}/expenses/{expense_id}',
        headers=auth_headers
    )
    
    assert delete_response.status_code == 204
    
    # Verify the expense was deleted
    get_response = client.get(
        f'/api/trips/{trip_id}/expenses',
        headers=auth_headers
    )
    expenses = json.loads(get_response.data)
    assert not any(expense['id'] == expense_id for expense in expenses)

def test_get_expense_summary(client, auth_headers, init_database, app):
    """Test getting expense summary for a trip."""
    trip_id = app.test_data['trip_id']
    
    # Create multiple expenses with different payers
    expense_data1 = {
        'amount': 60.00,
        'description': 'Breakfast',
        'date': '2025-06-02',
        'category': 'food',
        'split_among': ['test_user_id', 'test_user_id2']
    }
    
    client.post(
        f'/api/trips/{trip_id}/expenses',
        data=json.dumps(expense_data1),
        headers=auth_headers
    )
    
    # Create expense as second user
    second_user_headers = {
        'Authorization': 'Bearer test_token',
        'Content-Type': 'application/json',
        'Firebase-UID': 'test_user_id2'
    }
    
    expense_data2 = {
        'amount': 30.00,
        'description': 'Taxi',
        'date': '2025-06-02',
        'category': 'transportation',
        'split_among': ['test_user_id', 'test_user_id2']
    }
    
    client.post(
        f'/api/trips/{trip_id}/expenses',
        data=json.dumps(expense_data2),
        headers=second_user_headers
    )
    
    # Get summary
    response = client.get(
        f'/api/trips/{trip_id}/expenses/summary',
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    
    # Check that the summary has the correct structure
    assert 'total_expenses' in data
    assert 'by_user' in data
    assert 'by_category' in data
    
    # Total expenses should include all expenses
    assert float(data['total_expenses']) > 0
    
    # Check that both users appear in the user breakdown
    user_ids = [entry['user_id'] for entry in data['by_user']]
    assert 'test_user_id' in user_ids
    assert 'test_user_id2' in user_ids
    
    # Check that the categories appear in the category breakdown
    categories = [entry['category'] for entry in data['by_category']]
    assert 'food' in categories
    assert 'transportation' in categories

def test_settle_up(client, auth_headers, init_database, app):
    """Test settling up expenses between users."""
    trip_id = app.test_data['trip_id']
    
    # Create expenses with different balances
    # User 1 pays $100 for both users
    expense_data1 = {
        'amount': 100.00,
        'description': 'Hotel',
        'date': '2025-06-04',
        'split_among': ['test_user_id', 'test_user_id2']
    }
    
    client.post(
        f'/api/trips/{trip_id}/expenses',
        data=json.dumps(expense_data1),
        headers=auth_headers
    )
    
    # User 2 pays $40 for both users
    second_user_headers = {
        'Authorization': 'Bearer test_token',
        'Content-Type': 'application/json',
        'Firebase-UID': 'test_user_id2'
    }
    
    expense_data2 = {
        'amount': 40.00,
        'description': 'Dinner',
        'date': '2025-06-04',
        'split_among': ['test_user_id', 'test_user_id2']
    }
    
    client.post(
        f'/api/trips/{trip_id}/expenses',
        data=json.dumps(expense_data2),
        headers=second_user_headers
    )
    
    # Get settlement information
    response = client.get(
        f'/api/trips/{trip_id}/expenses/settle',
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    
    # There should be a settlement (User 2 owes User 1)
    assert len(data) > 0
    
    # Find the settlement from User 2 to User 1
    settlement = next((s for s in data if s['from_user_id'] == 'test_user_id2' and s['to_user_id'] == 'test_user_id'), None)
    
    # User 2 should owe User 1 $30 ($70 - $40 = $30)
    assert settlement is not None
    assert float(settlement['amount']) == 30.00

def test_expense_validation(client, auth_headers, init_database, app):
    """Test validation of expense data."""
    trip_id = app.test_data['trip_id']
    
    # Test with missing required fields
    invalid_data = {
        'description': 'Invalid Expense'
        # Missing amount and date
    }
    
    response = client.post(
        f'/api/trips/{trip_id}/expenses',
        data=json.dumps(invalid_data),
        headers=auth_headers
    )
    
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'error' in data
    
    # Test with invalid amount (negative)
    invalid_data = {
        'amount': -50.00,
        'description': 'Invalid Expense',
        'date': '2025-06-05'
    }
    
    response = client.post(
        f'/api/trips/{trip_id}/expenses',
        data=json.dumps(invalid_data),
        headers=auth_headers
    )
    
    assert response.status_code == 400
    
    # Test with invalid date format
    invalid_data = {
        'amount': 50.00,
        'description': 'Invalid Expense',
        'date': 'not-a-date'
    }
    
    response = client.post(
        f'/api/trips/{trip_id}/expenses',
        data=json.dumps(invalid_data),
        headers=auth_headers
    )
    
    assert response.status_code == 400