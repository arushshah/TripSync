from flask_sqlalchemy import SQLAlchemy
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get environment variables with defaults
FLASK_ENV = os.getenv('FLASK_ENV', 'development')
DATABASE_URL = os.getenv('DATABASE_URL')
DEV_DATABASE_URL = os.getenv('DEV_DATABASE_URL', 'postgresql://arush@localhost:5432/tripsync_dev')

# Initialize database
db = SQLAlchemy()

def get_database_url():
    """
    Returns the appropriate database URL based on the environment.
    Production: Uses DATABASE_URL from environment (Supabase PostgreSQL)
    Development: Uses local PostgreSQL database
    """
    if FLASK_ENV == 'production':
        if not DATABASE_URL:
            raise ValueError("DATABASE_URL environment variable must be set in production mode")
        
        # Handle PostgreSQL URL format differences if needed
        if DATABASE_URL.startswith('postgres://'):
            DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
        
        return DATABASE_URL
    else:
        # Use local PostgreSQL database for development
        if not DEV_DATABASE_URL:
            raise ValueError("DEV_DATABASE_URL must be set to a valid PostgreSQL connection string")
            
        return DEV_DATABASE_URL