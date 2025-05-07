from flask import request, jsonify, g
from functools import wraps
from firebase_admin import auth, credentials, initialize_app
import os
import json
from db import db
from functools import wraps
import sys
from utils.logger import setup_logger

# Set up logger for this module
logger = setup_logger('auth')

# Initialize Firebase Admin SDK with better error handling
firebase_app = None

try:
    # First priority: Check for JSON credentials in environment variable
    if os.getenv('FIREBASE_CREDENTIALS_JSON'):
        try:
            # Parse JSON from environment variable
            cred_json = json.loads(os.getenv('FIREBASE_CREDENTIALS_JSON'))
            cred = credentials.Certificate(cred_json)
            firebase_app = initialize_app(cred)
            logger.info("Firebase initialized successfully from JSON environment variable")
        except Exception as e:
            logger.error(f"Error initializing Firebase from JSON env var: {e}")
    
    # Second priority: Check for file path in environment variable
    elif os.getenv('FIREBASE_CREDENTIALS_PATH'):
        cred_path = os.getenv('FIREBASE_CREDENTIALS_PATH')
        if os.path.exists(cred_path):
            try:
                cred = credentials.Certificate(cred_path)
                firebase_app = initialize_app(cred)
                logger.info(f"Firebase initialized successfully from file: {cred_path}")
            except Exception as e:
                logger.error(f"Error initializing Firebase from credentials file: {e}")
        else:
            logger.error(f"Firebase credentials file not found at: {cred_path}")
            logger.debug(f"Current working directory: {os.getcwd()}")
    
    # Third priority: Look for credentials file in the current directory
    elif os.path.exists('firebase-credentials.json'):
        try:
            cred = credentials.Certificate('firebase-credentials.json')
            firebase_app = initialize_app(cred)
            logger.info("Firebase initialized successfully from firebase-credentials.json in current directory")
        except Exception as e:
            logger.error(f"Error initializing Firebase from local credentials file: {e}")
    
    # Last resort: Look for credentials in parent directory
    elif os.path.exists('../firebase-credentials.json'):
        try:
            cred = credentials.Certificate('../firebase-credentials.json')
            firebase_app = initialize_app(cred)
            logger.info("Firebase initialized successfully from firebase-credentials.json in parent directory")
        except Exception as e:
            logger.error(f"Error initializing Firebase from parent directory credentials file: {e}")
    
    else:
        logger.critical("Firebase credentials not found. Please set FIREBASE_CREDENTIALS_PATH or FIREBASE_CREDENTIALS_JSON")
        logger.debug("Paths checked:")
        logger.debug(f"- FIREBASE_CREDENTIALS_PATH: {os.getenv('FIREBASE_CREDENTIALS_PATH')}")
        logger.debug(f"- Current directory: {os.getcwd()}/firebase-credentials.json")
        logger.debug(f"- Parent directory: {os.getcwd()}/../firebase-credentials.json")
        
        # For local development only - you may want to disable this in production
        logger.warning("Running without Firebase authentication for development purposes.")

except Exception as e:
    logger.critical(f"Unexpected error initializing Firebase: {e}")

def authenticate_token(f=None):
    """Authentication middleware that can work as both a decorator and a direct function"""
    # When called directly without arguments from before_request
    if f is None:
        # Get the ID token from the Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            logger.warning(f"Missing or invalid authorization header: {auth_header if auth_header else 'None'}")
            return jsonify({'error': 'Missing or invalid authorization header'}), 401
        
        try:
            # Verify the ID token and get user info
            token = auth_header.split('Bearer ')[1]
            logger.debug("Verifying ID token")
            decoded_token = auth.verify_id_token(token)
            firebase_uid = decoded_token['uid']
            logger.debug(f"Token verified successfully for Firebase UID: {firebase_uid}")
            
            # Look up the user in our database using the Firebase UID
            from models.user import User
            
            user = User.query.filter_by(firebase_uid=firebase_uid).first()
            if not user:
                logger.warning(f"User with Firebase UID {firebase_uid} not found in database")
                return jsonify({'error': 'User account not found. Please complete registration.', 'code': 'REGISTRATION_REQUIRED'}), 403
            
            logger.debug(f"User found in database: {user.id} (Firebase UID: {firebase_uid})")
            
            # Add the user's internal ID and firebase UID to the request
            request.user_id = user.id  # This is our internal user ID
            request.firebase_uid = firebase_uid
            request.user_phone = decoded_token.get('phone_number')
            
            # Add user to request object for convenience in route handlers
            request.user = user
            
            # Add user_id to Flask g object for logging
            g.user_id = user.id
            
            # Return None to continue processing the request
            return None
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return jsonify({'error': f'Invalid authentication token: {str(e)}'}), 401
    
    # When used as a decorator
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get the ID token from the Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            logger.warning(f"Missing or invalid authorization header in decorator: {auth_header if auth_header else 'None'}")
            return jsonify({'error': 'Missing or invalid authorization header'}), 401
        
        token = auth_header.split('Bearer ')[1]
        
        try:
            # Verify the ID token and get user info
            logger.debug("Verifying ID token in decorator")
            decoded_token = auth.verify_id_token(token)
            firebase_uid = decoded_token['uid']
            logger.debug(f"Token verified successfully in decorator for Firebase UID: {firebase_uid}")
            
            # Look up the user in our database using the Firebase UID
            from models.user import User
            
            user = User.query.filter_by(firebase_uid=firebase_uid).first()
            if not user:
                # User exists in Firebase but not in our database
                logger.warning(f"User with Firebase UID {firebase_uid} not found in database (decorator)")
                return jsonify({'error': 'User account not found. Please complete registration.', 'code': 'REGISTRATION_REQUIRED'}), 403
            
            logger.debug(f"User found in database (decorator): {user.id}")
            
            # Add the user's internal ID and firebase UID to the request
            request.user_id = user.id  # This is our internal user ID
            request.firebase_uid = firebase_uid
            request.user_phone = decoded_token.get('phone_number')
            
            # Add user to request object for convenience in route handlers
            request.user = user
            
            # Add user_id to Flask g object for logging
            g.user_id = user.id
            
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Authentication error in decorator: {str(e)}")
            return jsonify({'error': f'Invalid authentication token: {str(e)}'}), 401
    
    return decorated_function

def is_trip_member(role=None):
    """
    Middleware to verify the user is a member of the trip.
    Optionally check for a specific role (planner, guest, viewer).
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'trip_id' not in kwargs:
                logger.warning("Trip ID not provided in request")
                return jsonify({'error': 'Trip ID not provided'}), 400
            
            trip_id = kwargs['trip_id']
            
            logger.debug(f"Checking if user {request.user_id} is a member of trip {trip_id}")
            
            # Check if the user is a member of this trip
            from models.trip import TripMember
            
            member = TripMember.query.filter_by(
                trip_id=trip_id,
                user_id=request.user_id
            ).first()
            
            if not member:
                logger.warning(f"User {request.user_id} attempted to access trip {trip_id} but is not a member")
                return jsonify({'error': 'You are not a member of this trip'}), 403
            
            # Check if specific role is required
            if role and member.role != role:
                logger.warning(f"User {request.user_id} attempted an action requiring {role} role in trip {trip_id}, but has {member.role} role")
                return jsonify({'error': f'This action requires {role} role'}), 403
            
            logger.debug(f"User {request.user_id} authorized as {member.role} for trip {trip_id}")
            
            # Add the member object to request for route handlers
            request.trip_member = member
            
            return f(*args, **kwargs)
            
        return decorated_function
    return decorator