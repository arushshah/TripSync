import os
import sys
import pytest
import tempfile
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from db import db
from app import create_app
from models.user import User


@pytest.fixture(scope='session')
def app():
    """Create and configure a Flask app for testing."""
    # Create a temporary file to isolate the database for each test
    db_fd, db_path = tempfile.mkstemp()
    
    app = create_app({
        'TESTING': True,
        'DATABASE': db_path,
        'SECRET_KEY': 'test_key',
        'FIREBASE_AUTH_DISABLED': True  # Disable real Firebase auth for testing
    })
    
    # Store test data in the app for access by tests
    app.test_data = {}
    
    yield app
    
    # Close and remove the temporary database
    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture(scope='session')
def client(app):
    """A test client for the app."""
    return app.test_client()


@pytest.fixture(scope='session')
def runner(app):
    """A test CLI runner for the app."""
    return app.test_cli_runner()


@pytest.fixture(scope='session')
def auth_headers():
    """Headers for authenticated requests."""
    return {
        'Authorization': 'Bearer test_token',
        'Content-Type': 'application/json',
        'Firebase-UID': 'test_user_id'
    }


@pytest.fixture(scope='session', autouse=True)
def init_database(app):
    """Initialize the database with test data."""
    with app.app_context():
        db.drop_all()
        db.create_all()
        # Create test users
        new_user = User(
                id="1",
                firebase_uid='firebase_uid1',
                phone_number='+11234567890',
                first_name='John',
                last_name='Doe'
            )
            
        db.session.add(new_user)
        db.session.commit()