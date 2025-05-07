from flask import Flask, request, jsonify, make_response, g
from flask_cors import CORS
from dotenv import load_dotenv
import os
from db import db
from middleware.auth import authenticate_token
from utils.logger import setup_logger

# Set up logger for this module
logger = setup_logger('app')

# Explicitly import all models to ensure they're registered with SQLAlchemy
from models.document import Document
from models.expense import Expense
from models.itinerary import ItineraryItem
from models.map import MapMarker
from models.poll import Poll
from models.todo import TodoItem
from models.trip import Trip, TripMember
from models.user import User

# Import route blueprints
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
logger.info("Environment variables loaded")

# Initialize Flask app
app = Flask(__name__)
logger.info("Flask app initialized")

# Disable strict URL trailing slash handling to prevent redirects on OPTIONS requests
app.url_map.strict_slashes = False

# Configure CORS properly with simpler, more consistent settings
CORS(app, 
     origins=["http://localhost:3000", "https://tripsync-gamma.vercel.app"],
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# Simplified global OPTIONS handler for all routes
@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    logger.debug(f"OPTIONS request for path: {path}")
    response = make_response()
    response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    response.headers.add('Access-Control-Max-Age', '3600')
    return response, 204

# Apply CORS headers to all responses
@app.after_request
def add_cors_headers(response):
    if request.method == 'OPTIONS':
        logger.debug(f"Adding CORS headers for OPTIONS request: {request.path}")
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
        response.headers['Access-Control-Max-Age'] = '3600'
        return response
        
    # For non-OPTIONS requests
    origin = request.headers.get('Origin')
    logger.debug(f"Request from origin: {origin}")
    allowed_origins = [
        'https://tripsync-gamma.vercel.app',
        'http://localhost:3000',
        'http://localhost:5555'
    ]
    
    if origin in allowed_origins:
        response.headers['Access-Control-Allow-Origin'] = origin
    else:
        # If origin is not in our allowed list, still allow it in development
        response.headers['Access-Control-Allow-Origin'] = '*'
        
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
    
    return response

# Set the database URI in the Flask app config
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
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
logger.info("Database initialized with app")

# Create database tables with better error handling
with app.app_context():
    try:
        db.create_all()
        logger.info("Successfully connected to database and created tables")
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        logger.error("Check that your DATABASE_URL is correct and that the database is accessible from your current network")
        # In production, you might want to continue without failing
        if os.getenv("FLASK_ENV") != "development":
            logger.warning("In production mode - continuing despite database error")
        else:
            logger.error("In development mode - raising error")
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
logger.info("All blueprints registered")

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
        logger.debug(f"Skipping authentication for exempt path: {request.path}")
        return
        
    # Authenticate all other requests
    logger.debug(f"Authenticating request for path: {request.path}")
    return authenticate_token()

# Add a health check endpoint
@app.route('/', methods=['GET'])
def health_check():
    logger.debug("Health check endpoint called")
    return jsonify({
        "status": "healthy",
        "message": "TripSync API is running"
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5555))
    debug_mode = os.environ.get("FLASK_ENV") == "development"
    logger.info(f"Starting app in {'debug' if debug_mode else 'production'} mode on port {port}")
    app.run(debug=debug_mode, host='0.0.0.0', port=port)