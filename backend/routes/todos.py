from flask import Blueprint, request, jsonify
from db import db
from models.todo import TodoItem
from middleware.auth import authenticate_token, is_trip_member
import uuid
import datetime

todos_bp = Blueprint('todos', __name__)

@todos_bp.route('/<trip_id>', methods=['GET'])
@authenticate_token
@is_trip_member()
def get_todos(trip_id):
    """Get all todo items for a trip"""
    # Optional filter by completion status
    completed = request.args.get('completed')
    assigned_to = request.args.get('assigned_to')
    
    query = TodoItem.query.filter_by(trip_id=trip_id)
    
    if completed is not None:
        completed_bool = completed.lower() == 'true'
        query = query.filter_by(completed=completed_bool)
    
    if assigned_to:
        query = query.filter_by(assigned_to_id=assigned_to)
    elif assigned_to == 'null':  # Explicitly check for unassigned items
        query = query.filter_by(assigned_to_id=None)
    
    todos = query.order_by(TodoItem.due_date, TodoItem.created_at).all()
    
    return jsonify([todo.to_dict() for todo in todos]), 200

@todos_bp.route('/<trip_id>', methods=['POST'])
@authenticate_token
@is_trip_member()
def create_todo(trip_id):
    """Create a new todo item"""
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    if 'title' not in data:
        return jsonify({'error': 'Title is required'}), 400
    
    # Parse due_date if provided
    due_date = None
    if 'due_date' in data and data['due_date']:
        try:
            due_date = datetime.datetime.fromisoformat(data['due_date']).date()
        except ValueError:
            return jsonify({'error': 'Invalid due_date format. Use ISO format (YYYY-MM-DD)'}), 400
    
    todo = TodoItem(
        id=str(uuid.uuid4()),
        trip_id=trip_id,
        creator_id=request.user_id,
        assigned_to_id=data.get('assigned_to_id'),
        title=data['title'],
        description=data.get('description'),
        due_date=due_date,
        completed=False
    )
    
    db.session.add(todo)
    db.session.commit()
    
    return jsonify(todo.to_dict()), 201

@todos_bp.route('/<trip_id>/<todo_id>', methods=['GET'])
@authenticate_token
@is_trip_member()
def get_todo(trip_id, todo_id):
    """Get a specific todo item"""
    todo = TodoItem.query.filter_by(id=todo_id, trip_id=trip_id).first()
    
    if not todo:
        return jsonify({'error': 'Todo item not found'}), 404
    
    return jsonify(todo.to_dict()), 200

@todos_bp.route('/<trip_id>/<todo_id>', methods=['PUT'])
@authenticate_token
@is_trip_member()
def update_todo(trip_id, todo_id):
    """Update a todo item"""
    todo = TodoItem.query.filter_by(id=todo_id, trip_id=trip_id).first()
    
    if not todo:
        return jsonify({'error': 'Todo item not found'}), 404
    
    data = request.json
    
    if 'title' in data:
        todo.title = data['title']
    
    if 'description' in data:
        todo.description = data['description']
    
    if 'assigned_to_id' in data:
        todo.assigned_to_id = data['assigned_to_id']
    
    if 'due_date' in data:
        if data['due_date']:
            try:
                todo.due_date = datetime.datetime.fromisoformat(data['due_date']).date()
            except ValueError:
                return jsonify({'error': 'Invalid due_date format. Use ISO format (YYYY-MM-DD)'}), 400
        else:
            todo.due_date = None
    
    if 'completed' in data:
        todo.completed = data['completed']
        if data['completed']:
            todo.completed_at = datetime.datetime.now()
        else:
            todo.completed_at = None
    
    db.session.commit()
    
    return jsonify(todo.to_dict()), 200

@todos_bp.route('/<trip_id>/<todo_id>/complete', methods=['POST'])
@authenticate_token
@is_trip_member()
def complete_todo(trip_id, todo_id):
    """Mark a todo item as complete"""
    todo = TodoItem.query.filter_by(id=todo_id, trip_id=trip_id).first()
    
    if not todo:
        return jsonify({'error': 'Todo item not found'}), 404
    
    todo.completed = True
    todo.completed_at = datetime.datetime.now()
    db.session.commit()
    
    return jsonify(todo.to_dict()), 200

@todos_bp.route('/<trip_id>/<todo_id>/uncomplete', methods=['POST'])
@authenticate_token
@is_trip_member()
def uncomplete_todo(trip_id, todo_id):
    """Mark a todo item as incomplete"""
    todo = TodoItem.query.filter_by(id=todo_id, trip_id=trip_id).first()
    
    if not todo:
        return jsonify({'error': 'Todo item not found'}), 404
    
    todo.completed = False
    todo.completed_at = None
    db.session.commit()
    
    return jsonify(todo.to_dict()), 200

@todos_bp.route('/<trip_id>/<todo_id>', methods=['DELETE'])
@authenticate_token
@is_trip_member()
def delete_todo(trip_id, todo_id):
    """Delete a todo item"""
    todo = TodoItem.query.filter_by(id=todo_id, trip_id=trip_id).first()
    
    if not todo:
        return jsonify({'error': 'Todo item not found'}), 404
    
    db.session.delete(todo)
    db.session.commit()
    
    return jsonify({'message': 'Todo item deleted successfully'}), 200

@todos_bp.route('/<trip_id>/assigned-to-me', methods=['GET'])
@authenticate_token
@is_trip_member()
def get_my_todos(trip_id):
    """Get all todo items assigned to the current user"""
    todos = TodoItem.query.filter_by(
        trip_id=trip_id,
        assigned_to_id=request.user_id
    ).order_by(TodoItem.due_date, TodoItem.created_at).all()
    
    return jsonify([todo.to_dict() for todo in todos]), 200