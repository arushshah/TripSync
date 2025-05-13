#!/bin/bash

echo "Populating database with test users and trips..."

# Add parent directory to Python path so we can import modules
export PYTHONPATH=$PYTHONPATH:$(dirname "$(dirname "$(realpath "$0")")")

# Create a temporary Python script
TMP_SCRIPT=$(mktemp)

cat > $TMP_SCRIPT << 'EOF'
import os
import sys
from dotenv import load_dotenv
import uuid
from datetime import datetime, timedelta

# Add the parent directory to the path so we can import the models
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load environment variables from .env
load_dotenv()

# Import Flask app and database
from app import create_app, db
from models.user import User
from models.trip import Trip
from models.trip import TripMember
from models.todo import TodoItem

app = create_app()
# Test user data
test_users = [
    {
        "phone_number": "+11234567890",
        "firebase_uid": "Xwk2jUVWllaBrwU3f5SXpVewRWu1",
        "first_name": "John",
        "last_name": "Doe"
    },
    {
        "phone_number": "+12345678901",
        "firebase_uid": "zKULBecBFBNL0b3X569Oqrp3HRH3",
        "first_name": "Jane",
        "last_name": "Smith"
    },
    {
        "phone_number": "+13456789012",
        "firebase_uid": "ryQaKFAnWUgogrLVCXIPxQ947Gp1",
        "first_name": "Michael",
        "last_name": "Johnson"
    },
    {
        "phone_number": "+14567890123",
        "firebase_uid": "SsaTzggoOycXqOgXHbMWq4X5qeE3",
        "first_name": "Emily",
        "last_name": "Williams"
    }
]

# Create users in database and track their IDs for trip creation
user_ids = {}

with app.app_context():
    print("Connected to database")
    for user_data in test_users:
        # Check if user already exists
        existing_user = User.query.filter_by(phone_number=user_data["phone_number"]).first()
        
        if existing_user:
            print(f"User with phone number {user_data['phone_number']} already exists")
            user_ids[user_data['first_name']] = existing_user.id
        else:
            # Create a new user
            new_user = User(
                firebase_uid=user_data["firebase_uid"],
                phone_number=user_data["phone_number"],
                first_name=user_data["first_name"],
                last_name=user_data["last_name"]
            )
            
            # Add to database
            db.session.add(new_user)
            db.session.flush()  # Flush to get the ID without committing
            user_ids[user_data['first_name']] = new_user.id
            print(f"Created user: {user_data['first_name']} {user_data['last_name']} ({user_data['phone_number']})")
    
    # Commit user changes
    db.session.commit()
    print("Users created successfully!")
    
    # Create trips
    print("\nCreating trips...")
    
    # Trip 1: Created by John Doe
    john_trip = Trip.query.filter_by(name="Beach Weekend").first()
    if not john_trip:
        start_date = datetime.now() + timedelta(days=30)
        end_date = start_date + timedelta(days=3)
        
        john_trip = Trip(
            id=str(uuid.uuid4()),
            name="Beach Weekend",
            description="Weekend getaway to the beach",
            location="Miami Beach, FL",
            start_date=start_date.date(),
            end_date=end_date.date(),
            guest_limit=8,
            creator_id=user_ids["John"]
        )
        db.session.add(john_trip)
        db.session.flush()
        
        # Add John as a member (planner) - note we're not specifying id since it's auto-incrementing
        john_member = TripMember(
            trip_id=john_trip.id,
            user_id=user_ids["John"],
            role="planner",
            rsvp_status="going"
        )
        db.session.add(john_member)
        print(f"Created trip: {john_trip.name} by John Doe")
    else:
        print(f"Trip '{john_trip.name}' already exists")
    
    # Trip 2: Created by John Doe, Jane Smith invited
    collab_trip = Trip.query.filter_by(name="Mountain Retreat").first()
    if not collab_trip:
        start_date = datetime.now() + timedelta(days=60)
        end_date = start_date + timedelta(days=5)
        
        collab_trip = Trip(
            id=str(uuid.uuid4()),
            name="Mountain Retreat",
            description="Relaxing mountain getaway with hiking and outdoor activities",
            location="Aspen, CO",
            start_date=start_date.date(),
            end_date=end_date.date(),
            guest_limit=6,
            creator_id=user_ids["John"]
        )
        db.session.add(collab_trip)
        db.session.flush()
        
        # Add John as a member (planner) - note we're not specifying id since it's auto-incrementing
        john_member = TripMember(
            trip_id=collab_trip.id,
            user_id=user_ids["John"],
            role="planner",
            rsvp_status="going"
        )
        db.session.add(john_member)
        
        # Add Jane as a member (guest, invited by John)
        jane_member = TripMember(
            trip_id=collab_trip.id,
            user_id=user_ids["Jane"],
            role="guest",
            rsvp_status="pending"
            # Note: invited_by is missing in the TripMember model, so removed it
        )
        db.session.add(jane_member)
        
        # Add Michael as a member (guest, already accepted)
        michael_member = TripMember(
            trip_id=collab_trip.id,
            user_id=user_ids["Michael"],
            role="guest",
            rsvp_status="going"
            # Note: invited_at and responded_at are missing in the TripMember model, so removed them
        )
        db.session.add(michael_member)
        
        print(f"Created trip: {collab_trip.name} by John Doe with Jane Smith invited")
    else:
        print(f"Trip '{collab_trip.name}' already exists")
    
    # Create to-do items for each trip
    print("\nCreating to-do items...")
    
    # Check if to-do items already exist for Beach Weekend
    beach_trip = Trip.query.filter_by(name="Beach Weekend").first()
    if beach_trip:
        existing_todos = TodoItem.query.filter_by(trip_id=beach_trip.id).count()
        if existing_todos == 0:
            # Create to-do items for Beach Weekend trip
            beach_todos = [
                {
                    "title": "Book hotel rooms",
                    "description": "Find beachfront hotel with good reviews",
                    "assigned_to_id": user_ids["John"],
                    "completed": True,
                    "due_date": (datetime.now() + timedelta(days=10)).date()
                },
                {
                    "title": "Rent a car",
                    "description": "SUV or minivan to fit everyone and luggage",
                    "assigned_to_id": user_ids["Jane"],
                    "completed": False,
                    "due_date": (datetime.now() + timedelta(days=20)).date()
                },
                {
                    "title": "Research beach activities",
                    "description": "Find water sports, restaurants, and nightlife options",
                    "assigned_to_id": user_ids["Michael"],
                    "completed": False,
                    "due_date": (datetime.now() + timedelta(days=15)).date()
                },
                {
                    "title": "Create packing checklist",
                    "description": "Include swimwear, sunscreen, beach towels, etc.",
                    "assigned_to_id": None,
                    "completed": False,
                    "due_date": (datetime.now() + timedelta(days=25)).date()
                },
                {
                    "title": "Buy new swimsuit",
                    "description": None,
                    "assigned_to_id": user_ids["Emily"],
                    "completed": False,
                    "due_date": (datetime.now() + timedelta(days=22)).date()
                }
            ]
            
            for todo_data in beach_todos:
                todo = TodoItem(
                    trip_id=beach_trip.id,
                    title=todo_data["title"],
                    description=todo_data["description"],
                    assigned_to_id=todo_data["assigned_to_id"],
                    completed=todo_data["completed"],
                    due_date=todo_data["due_date"],
                    creator_id=user_ids["John"]
                )
                db.session.add(todo)
            print(f"Created 5 to-do items for Beach Weekend trip")
    
    # Check if to-do items already exist for Mountain Retreat
    mountain_trip = Trip.query.filter_by(name="Mountain Retreat").first()
    if mountain_trip:
        existing_todos = TodoItem.query.filter_by(trip_id=mountain_trip.id).count()
        if existing_todos == 0:
            # Create to-do items for Mountain Retreat trip
            mountain_todos = [
                {
                    "title": "Book mountain cabin",
                    "description": "Look for one with a hot tub and mountain views",
                    "assigned_to_id": user_ids["John"],
                    "completed": True,
                    "due_date": (datetime.now() + timedelta(days=5)).date()
                },
                {
                    "title": "Check hiking trails",
                    "description": "Find trails suitable for all skill levels",
                    "assigned_to_id": user_ids["Michael"],
                    "completed": True,
                    "due_date": (datetime.now() + timedelta(days=15)).date()
                },
                {
                    "title": "Rent outdoor equipment",
                    "description": "Hiking poles, backpacks, etc.",
                    "assigned_to_id": user_ids["Jane"],
                    "completed": False,
                    "due_date": (datetime.now() + timedelta(days=40)).date()
                },
                {
                    "title": "Plan meals and grocery shopping",
                    "description": "Prepare meal plan and shopping list for 5 days",
                    "assigned_to_id": user_ids["Emily"],
                    "completed": False,
                    "due_date": (datetime.now() + timedelta(days=50)).date()
                },
                {
                    "title": "Arrange transportation to mountain",
                    "description": "Check car rental options or carpooling",
                    "assigned_to_id": None,
                    "completed": False,
                    "due_date": (datetime.now() + timedelta(days=30)).date()
                },
                {
                    "title": "Check weather forecast",
                    "description": "Monitor weather conditions before trip",
                    "assigned_to_id": user_ids["John"],
                    "completed": False,
                    "due_date": (datetime.now() + timedelta(days=58)).date()
                },
                {
                    "title": "Create emergency contact list",
                    "description": "Include local emergency services and nearest hospital",
                    "assigned_to_id": user_ids["Jane"],
                    "completed": False,
                    "due_date": None
                }
            ]
            
            for todo_data in mountain_todos:
                todo = TodoItem(
                    trip_id=mountain_trip.id,
                    title=todo_data["title"],
                    description=todo_data["description"],
                    assigned_to_id=todo_data["assigned_to_id"],
                    completed=todo_data["completed"],
                    due_date=todo_data["due_date"],
                    creator_id=user_ids["John"]
                )
                db.session.add(todo)
            print(f"Created 7 to-do items for Mountain Retreat trip")
    
    # Commit all changes
    db.session.commit()
    print("\nDatabase populated successfully!")
EOF

# Run the Python script
python $TMP_SCRIPT

# Clean up
rm $TMP_SCRIPT

echo "Done!"