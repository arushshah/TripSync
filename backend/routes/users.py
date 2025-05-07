from flask import Blueprint, request, jsonify, g
from db import db
from models.user import User
from middleware.auth import authenticate_token
from utils.logger import setup_logger

# Set up logger for this module
logger = setup_logger('routes.users')

users_bp = Blueprint('users', __name__)

@users_bp.route('/profile', methods=['GET'])
@authenticate_token
def get_profile():
    """Get the current user's profile"""
    # Since authenticate_token middleware now looks up the user by firebase_uid
    # and sets request.user_id to the internal ID, we can directly use this ID
    # The User object is also attached to request.user for convenience
    
    logger.debug(f"Getting profile for user: {request.user_id}")
    
    if not request.user:
        logger.error(f"User {request.user_id} not found in database")
        return jsonify({'error': 'User not found'}), 404
    
    logger.info(f"Profile successfully retrieved for user: {request.user_id}")
    return jsonify(request.user.to_dict()), 200

@users_bp.route('/profile', methods=['PUT'])
@authenticate_token
def update_profile():
    """Update the current user's profile"""
    logger.debug(f"Updating profile for user: {request.user_id}")
    
    user = User.query.get(request.user_id)
    
    if not user:
        logger.error(f"User {request.user_id} not found in database during profile update")
        return jsonify({'error': 'User not found'}), 404
    
    data = request.json
    logger.debug(f"Profile update data: {data}")
    
    # Log previous values for tracking changes
    previous_data = {
        'first_name': user.first_name,
        'last_name': user.last_name,
        'profile_photo': user.profile_photo
    }
    
    if 'first_name' in data:
        user.first_name = data['first_name']
    
    if 'last_name' in data:
        user.last_name = data['last_name']
    
    if 'profile_photo' in data:
        user.profile_photo = data['profile_photo']
    
    try:
        db.session.commit()
        logger.info(f"Profile updated for user {request.user_id}: {previous_data} -> {data}")
        return jsonify(user.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating profile for user {request.user_id}: {str(e)}")
        return jsonify({'error': 'Failed to update profile'}), 500

@users_bp.route('/<user_id>', methods=['GET'])
@authenticate_token
def get_user(user_id):
    """Get a specific user's profile"""
    logger.debug(f"User {request.user_id} requesting profile for user: {user_id}")
    
    user = User.query.get(user_id)
    
    if not user:
        logger.warning(f"User {request.user_id} requested non-existent user profile: {user_id}")
        return jsonify({'error': 'User not found'}), 404
    
    logger.info(f"Profile for user {user_id} retrieved by user {request.user_id}")
    return jsonify(user.to_dict()), 200

@users_bp.route('/search', methods=['GET'])
@authenticate_token
def search_users():
    """Search users by phone number"""
    query = request.args.get('q', '')
    logger.debug(f"User {request.user_id} searching users with query: {query}")
    
    if not query or len(query) < 3:
        logger.warning(f"User {request.user_id} provided invalid search query: {query}")
        return jsonify({'error': 'Search query must be at least 3 characters'}), 400
    
    try:
        users = User.query.filter(User.phone_number.like(f'%{query}%')).limit(10).all()
        logger.info(f"User search by {request.user_id} returned {len(users)} results for query: {query}")
        return jsonify([user.to_dict() for user in users]), 200
    except Exception as e:
        logger.error(f"Error searching users with query '{query}': {str(e)}")
        return jsonify({'error': 'An error occurred while searching users'}), 500

@users_bp.route('/register', methods=['POST', 'OPTIONS'])
def register_user():
    # Handle OPTIONS request for CORS preflight
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.get_json()
    phone_number = data.get('phone_number')
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    firebase_uid = data.get('uid')  # Firebase UID from authentication
    
    logger.debug(f"Registration attempt for phone: {phone_number}, uid: {firebase_uid}")

    if not all([phone_number, first_name, last_name, firebase_uid]):
        missing = [field for field, value in {
            'phone_number': phone_number,
            'first_name': first_name,
            'last_name': last_name,
            'uid': firebase_uid
        }.items() if not value]
        
        logger.warning(f"Registration failed - missing fields: {', '.join(missing)}")
        return jsonify({'error': 'Missing required fields'}), 400

    existing = User.query.filter_by(phone_number=phone_number).first()
    if existing:
        logger.warning(f"Registration failed - phone number already exists: {phone_number}")
        return jsonify({'error': 'User already exists'}), 409

    user = User(
        firebase_uid=firebase_uid,  # Store Firebase UID separately
        phone_number=phone_number,
        first_name=first_name,
        last_name=last_name
    )
    
    try:
        db.session.add(user)
        db.session.commit()
        logger.info(f"User registered successfully: ID={user.id}, phone={phone_number}, firebase_uid={firebase_uid}")
        return jsonify(user.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error registering user: {str(e)}")
        return jsonify({'error': 'Registration failed due to an internal error'}), 500

@users_bp.route('/check-phone', methods=['POST', 'OPTIONS'])
def check_phone_exists():
    # Handle OPTIONS request for CORS preflight
    if request.method == 'OPTIONS':
        return '', 204

    # For POST requests
    if request.is_json:
        data = request.get_json()
    else:
        # Handle non-JSON content types
        logger.warning(f"Check phone request with invalid content type: {request.content_type}")
        return jsonify({'error': 'Content-Type must be application/json'}), 415
        
    phone_number = data.get('phone_number')
    logger.debug(f"Checking if phone number exists: {phone_number}")
    
    if not phone_number:
        logger.warning("Check phone request missing phone_number")
        return jsonify({'error': 'Phone number is required'}), 400
    
    try:
        user = User.query.filter_by(phone_number=phone_number).first()
        exists = user is not None
        logger.info(f"Phone number check: {phone_number}, exists={exists}")
        
        return jsonify({
            'exists': exists
        }), 200
    except Exception as e:
        logger.error(f"Error checking phone number: {str(e)}")
        return jsonify({'error': 'An error occurred while checking the phone number'}), 500