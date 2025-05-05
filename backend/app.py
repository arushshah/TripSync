from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
from db import db
from middleware.auth import authenticate_token
from routes.trips import trips_bp
from routes.users import users_bp
from routes.rsvp import rsvp_bp
from routes.documents import documents_bp
from routes.itinerary import itinerary_bp
from routes.todos import todos_bp
from routes.expenses import expenses_bp
from routes.polls import polls_bp
from routes.map import map_bp

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Disable strict URL trailing slash handling to prevent redirects on OPTIONS requests
app.url_map.strict_slashes = False

# Configure CORS to properly handle preflight requests
CORS(app, 
     origins=["http://localhost:3000", "http://localhost:5555", "https://tripsync-gamma.vercel.app"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
     supports_credentials=True,
     max_age=3600)

# Configure database with better error handling
database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("ERROR: DATABASE_URL environment variable is not set!")

# If using pg8000 driver instead of psycopg2
if database_url and database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

# Set the modified URL
app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_pre_ping": True,  # Check connection before use
    "pool_recycle": 300,    # Recycle connections every 5 minutes
    "connect_args": {       # Connection timeout settings
        "connect_timeout": 10
    }
}

# Initialize database with app
db.init_app(app)

# Create database tables with better error handling
with app.app_context():
    try:
        db.create_all()
        print("Successfully connected to database and created tables")
    except Exception as e:
        print(f"Database connection error: {e}")
        print("Check that your DATABASE_URL is correct and that the database is accessible from your current network")
        # In production, you might want to continue without failing
        if os.getenv("FLASK_ENV") != "development":
            print("In production mode - continuing despite database error")
        else:
            print("In development mode - raising error")
            raise e

# Register blueprints
app.register_blueprint(trips_bp, url_prefix='/api/trips')
app.register_blueprint(users_bp, url_prefix='/api/users')
app.register_blueprint(rsvp_bp, url_prefix='/api/rsvp')
app.register_blueprint(documents_bp, url_prefix='/api/documents')
app.register_blueprint(itinerary_bp, url_prefix='/api/itinerary')
app.register_blueprint(todos_bp, url_prefix='/api/todos')
app.register_blueprint(expenses_bp, url_prefix='/api/expenses')
app.register_blueprint(polls_bp, url_prefix='/api/polls')
app.register_blueprint(map_bp, url_prefix='/api/map')

# Middleware to authenticate token for protected routes only
@app.before_request
def before_request():
    # Skip authentication for paths that don't require it
    exempt_paths = [
        '/api/users/register',
        '/api/users/check-phone'
    ]
    
    # Skip OPTIONS requests (for CORS preflight)
    if request.method == 'OPTIONS':
        return
    
    # Skip authentication for exempt paths
    if request.path in exempt_paths:
        return
        
    # Authenticate all other requests
    return authenticate_token()

# Run the app
if __name__ == "__main__":
    app.run(debug=True, port=5555)