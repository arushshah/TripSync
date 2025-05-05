from flask import request, jsonify
from functools import wraps
from firebase_admin import auth, credentials, initialize_app
import os
import json
from db import db
from functools import wraps
import sys

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
            print("Firebase initialized successfully from JSON environment variable")
        except Exception as e:
            print(f"Error initializing Firebase from JSON env var: {e}")
    
    # Second priority: Check for file path in environment variable
    elif os.getenv('FIREBASE_CREDENTIALS_PATH'):
        cred_path = os.getenv('FIREBASE_CREDENTIALS_PATH')
        if os.path.exists(cred_path):
            try:
                cred = credentials.Certificate(cred_path)
                firebase_app = initialize_app(cred)
                print(f"Firebase initialized successfully from file: {cred_path}")
            except Exception as e:
                print(f"Error initializing Firebase from credentials file: {e}")
        else:
            print(f"Firebase credentials file not found at: {cred_path}")
            print(f"Current working directory: {os.getcwd()}")
    
    # Third priority: Look for credentials file in the current directory
    elif os.path.exists('firebase-credentials.json'):
        try:
            cred = credentials.Certificate('firebase-credentials.json')
            firebase_app = initialize_app(cred)
            print("Firebase initialized successfully from firebase-credentials.json in current directory")
        except Exception as e:
            print(f"Error initializing Firebase from local credentials file: {e}")
    
    # Last resort: Look for credentials in parent directory
    elif os.path.exists('../firebase-credentials.json'):
        try:
            cred = credentials.Certificate('../firebase-credentials.json')
            firebase_app = initialize_app(cred)
            print("Firebase initialized successfully from firebase-credentials.json in parent directory")
        except Exception as e:
            print(f"Error initializing Firebase from parent directory credentials file: {e}")
    
    else:
        print("ERROR: Firebase credentials not found. Please set FIREBASE_CREDENTIALS_PATH or FIREBASE_CREDENTIALS_JSON")
        print("Paths checked:")
        print(f"- FIREBASE_CREDENTIALS_PATH: {os.getenv('FIREBASE_CREDENTIALS_PATH')}")
        print(f"- Current directory: {os.getcwd()}/firebase-credentials.json")
        print(f"- Parent directory: {os.getcwd()}/../firebase-credentials.json")
        
        # For local development only - you may want to disable this in production
        print("WARNING: Running without Firebase authentication for development purposes.")

except Exception as e:
    print(f"Unexpected error initializing Firebase: {e}")

def authenticate_token(f=None):
    """Authentication middleware that can work as both a decorator and a direct function"""
    # When called directly without arguments from before_request
    if f is None:
        # Get the ID token from the Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid authorization header'}), 401
        
        try:
            # Verify the ID token and get user info
            token = auth_header.split('Bearer ')[1]
            decoded_token = auth.verify_id_token(token)
            user_id = decoded_token['uid']
            
            # Add the user ID to the request for route handlers to use
            request.user_id = user_id
            request.user_phone = decoded_token.get('phone_number')
            
            # Check if user exists in our database
            from models.user import User
            
            user = User.query.get(user_id)
            if not user:
                return jsonify({'error': 'User account not found. Please complete registration.', 'code': 'REGISTRATION_REQUIRED'}), 403
            
            # Add user to request object for convenience in route handlers
            request.user = user
            
            # Return None to continue processing the request
            return None
        except Exception as e:
            return jsonify({'error': f'Invalid authentication token: {str(e)}'}), 401
    
    # When used as a decorator
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get the ID token from the Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid authorization header'}), 401
        
        token = auth_header.split('Bearer ')[1]
        
        try:
            # Verify the ID token and get user info
            decoded_token = auth.verify_id_token(token)
            user_id = decoded_token['uid']
            
            # Add the user ID to the request for route handlers to use
            request.user_id = user_id
            request.user_phone = decoded_token.get('phone_number')
            
            # Check if user exists in our database
            from models.user import User
            
            user = User.query.get(user_id)
            if not user:
                # User exists in Firebase but not in our database
                return jsonify({'error': 'User account not found. Please complete registration.', 'code': 'REGISTRATION_REQUIRED'}), 403
            
            # Add user to request object for convenience in route handlers
            request.user = user
            
            return f(*args, **kwargs)
        except Exception as e:
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
                return jsonify({'error': 'Trip ID not provided'}), 400
            
            trip_id = kwargs['trip_id']
            
            # Check if the user is a member of this trip
            from models.trip import TripMember
            
            member = TripMember.query.filter_by(
                trip_id=trip_id,
                user_id=request.user_id
            ).first()
            
            if not member:
                return jsonify({'error': 'You are not a member of this trip'}), 403
            
            # Check if specific role is required
            if role and member.role != role:
                return jsonify({'error': f'This action requires {role} role'}), 403
            
            # Add the member object to request for route handlers
            request.trip_member = member
            
            return f(*args, **kwargs)
            
        return decorated_function
    return decorator