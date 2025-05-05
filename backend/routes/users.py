from flask import Blueprint, request, jsonify
from db import db
from models.user import User
from middleware.auth import authenticate_token

users_bp = Blueprint('users', __name__)

@users_bp.route('/profile', methods=['GET'])
@authenticate_token
def get_profile():
    """Get the current user's profile"""
    user = User.query.get(request.user_id)
    
    if not user:
        # Create a new user if they don't exist
        user = User(
            id=request.user_id,
            phone_number=request.user_phone,
            first_name=request.user_first_name,
            last_name=request.user_last_name,
            profile_photo=None
        )
        db.session.add(user)
        db.session.commit()
    
    return jsonify(user.to_dict()), 200

@users_bp.route('/profile', methods=['PUT'])
@authenticate_token
def update_profile():
    """Update the current user's profile"""
    user = User.query.get(request.user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.json
    
    if 'first_name' in data:
        user.first_name = data['first_name']
    
    if 'last_name' in data:
        user.last_name = data['last_name']
    
    if 'profile_photo' in data:
        user.profile_photo = data['profile_photo']
    
    db.session.commit()
    
    return jsonify(user.to_dict()), 200

@users_bp.route('/<user_id>', methods=['GET'])
@authenticate_token
def get_user(user_id):
    """Get a specific user's profile"""
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify(user.to_dict()), 200

@users_bp.route('/search', methods=['GET'])
@authenticate_token
def search_users():
    """Search users by phone number"""
    query = request.args.get('q', '')
    
    if not query or len(query) < 3:
        return jsonify({'error': 'Search query must be at least 3 characters'}), 400
    
    users = User.query.filter(User.phone_number.like(f'%{query}%')).limit(10).all()
    
    return jsonify([user.to_dict() for user in users]), 200

@users_bp.route('/register', methods=['POST', 'OPTIONS'])
def register_user():
    # Handle OPTIONS request for CORS preflight
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.get_json()
    phone_number = data.get('phone_number')
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    uid = data.get('uid')  # Firebase UID, should be provided by frontend after verification

    if not all([phone_number, first_name, last_name, uid]):
        return jsonify({'error': 'Missing required fields'}), 400

    existing = User.query.filter_by(phone_number=phone_number).first()
    if existing:
        return jsonify({'error': 'User already exists'}), 409

    user = User(
        id=uid,
        phone_number=phone_number,
        first_name=first_name,
        last_name=last_name
    )
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201

@users_bp.route('/check-phone', methods=['POST', 'OPTIONS'])
def check_phone_exists():

    # For POST requests
    if request.is_json:
        data = request.get_json()
    else:
        # Handle non-JSON content types
        return jsonify({'error': 'Content-Type must be application/json'}), 415
        
    phone_number = data.get('phone_number')
    
    if not phone_number:
        return jsonify({'error': 'Phone number is required'}), 400
    
    user = User.query.filter_by(phone_number=phone_number).first()
    
    return jsonify({
        'exists': user is not None
    }), 200