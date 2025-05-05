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

# Configure CORS with more specific settings
CORS(app, resources={r"/api/*": {
    "origins": ["http://localhost:3000", "http://localhost:5555", "https://tripsync.vercel.app", "https://tripsync-app.vercel.app"],
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
    "supports_credentials": True
}})

# Configure database
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize database with app
db.init_app(app)

# Create database tables
with app.app_context():
    db.create_all()

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

# Root route
@app.route('/')
def index():
    return jsonify({
        "message": "Welcome to TripSync API",
        "status": "online"
    })

# Global OPTIONS request handler for CORS preflight requests
@app.route('/api/<path:path>', methods=['OPTIONS'])
def options_handler(path):
    return '', 204

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5555)