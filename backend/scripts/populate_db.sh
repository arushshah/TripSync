#!/bin/bash

echo "Populating database with test users..."

# Add parent directory to Python path so we can import modules
export PYTHONPATH=$PYTHONPATH:$(dirname "$(dirname "$(realpath "$0")")")

# Create a temporary Python script
TMP_SCRIPT=$(mktemp)

cat > $TMP_SCRIPT << 'EOF'
import os
import sys
from dotenv import load_dotenv
import uuid

# Add the parent directory to the path so we can import the models
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load environment variables from .env
load_dotenv()

# Import Flask app and database
from app import app, db
from models.user import User

# Test user data
test_users = [
    {
        "phone_number": "+11234567890",
        "first_name": "John",
        "last_name": "Doe"
    },
    {
        "phone_number": "+12345678901",
        "first_name": "Jane",
        "last_name": "Smith"
    },
    {
        "phone_number": "+13456789012",
        "first_name": "Michael",
        "last_name": "Johnson"
    },
    {
        "phone_number": "+14567890123",
        "first_name": "Emily",
        "last_name": "Williams"
    }
]

# Create users in database
with app.app_context():
    print("Connected to database")
    for user_data in test_users:
        # Check if user already exists
        existing_user = User.query.filter_by(phone_number=user_data["phone_number"]).first()
        
        if existing_user:
            print(f"User with phone number {user_data['phone_number']} already exists")
        else:
            # Create a new user
            new_user = User(
                firebase_uid=str(uuid.uuid4()),  # Mock Firebase UID for testing
                phone_number=user_data["phone_number"],
                first_name=user_data["first_name"],
                last_name=user_data["last_name"]
            )
            
            # Add to database
            db.session.add(new_user)
            print(f"Created user: {user_data['first_name']} {user_data['last_name']} ({user_data['phone_number']})")
    
    # Commit all changes
    db.session.commit()
    print("Database populated successfully!")
EOF

# Run the Python script
python $TMP_SCRIPT

# Clean up
rm $TMP_SCRIPT

echo "Done!"