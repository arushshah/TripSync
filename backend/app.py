from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
from dotenv import load_dotenv
import os
from db import db
from middleware.auth import authenticate_token
from utils.logger import setup_logger

# Models (force-import to register with SQLAlchemy)
from models.document import Document
from models.expense import Expense
from models.itinerary import ItineraryItem
from models.map import MapMarker
from models.poll import Poll
from models.todo import TodoItem
from models.trip import Trip, TripMember
from models.user import User

# Blueprints
from routes.trips import trips_bp
from routes.users import users_bp
from routes.rsvp import rsvp_bp
from routes.documents import documents_bp
from routes.itinerary import itinerary_bp
from routes.todos import todos_bp
from routes.expenses import expenses_bp
from routes.polls import polls_bp
from routes.map import map_bp

def create_app(config_override=None):
    logger = setup_logger('app')
    load_dotenv()
    app = Flask(__name__)
    app.url_map.strict_slashes = False

    # Load default config
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "connect_args": {"connect_timeout": 10}
    }

    # Override config for testing
    if config_override:
        app.config.update(config_override)

    # CORS setup
    CORS(app,
         origins=["http://localhost:3000", "https://tripsync-gamma.vercel.app"],
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         expose_headers=["Content-Type", "Authorization"],
         max_age=3600)

    db.init_app(app)

    with app.app_context():
        try:
            db.create_all()
        except Exception as e:
            logger.error(f"Database connection error: {e}")
            if os.getenv("FLASK_ENV") != "development":
                logger.warning("Continuing despite DB error (prod)")
            else:
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

    @app.before_request
    def before_request():
        # Always allow OPTIONS requests without authentication for CORS preflight
        if request.method == 'OPTIONS':
            return

        # List of paths that don't require authentication
        exempt_paths = ['/api/users/register', '/api/users/check-phone', '/api/health']
        if request.path in exempt_paths:
            return
            
        # Authenticate all other requests
        return authenticate_token()

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get('Origin')
        allowed_origins = [
            'https://tripsync-gamma.vercel.app',
            'http://localhost:3000',
            'http://localhost:5555'
        ]
        
        if origin in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
        else:
            response.headers['Access-Control-Allow-Origin'] = allowed_origins[0]
            
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        
        # Add extra headers for OPTIONS requests
        if request.method == 'OPTIONS':
            response.headers['Access-Control-Max-Age'] = '3600'
            # Override status code for OPTIONS to ensure 200 OK
            if response.status_code == 401 or response.status_code == 403:
                response.status_code = 200
                
        return response

    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({"status": "healthy", "message": "TripSync API is running"})

    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", 5555))
    debug_mode = os.environ.get("FLASK_ENV") == "development"
    app.run(debug=debug_mode, host='0.0.0.0', port=port)
