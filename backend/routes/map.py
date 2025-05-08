from flask import Blueprint, request, jsonify
from db import db
from models.map import MapMarker
from middleware.auth import authenticate_token, is_trip_member
import uuid

map_bp = Blueprint('map', __name__)

@map_bp.route('/<trip_id>/markers', methods=['GET'])
@authenticate_token
@is_trip_member()
def get_markers(trip_id):
    """Get all map markers for a trip"""
    # Optional category filter
    category = request.args.get('category')
    
    query = MapMarker.query.filter_by(trip_id=trip_id)
    
    if category:
        query = query.filter_by(category=category)
        
    markers = query.all()
    
    return jsonify([marker.to_dict() for marker in markers]), 200

@map_bp.route('/<trip_id>/markers', methods=['POST'])
@authenticate_token
@is_trip_member()
def create_marker(trip_id):
    """Create a new map marker"""
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Remove category from required fields and make latitude/longitude required
    required_fields = ['name', 'latitude', 'longitude']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    marker = MapMarker(
        id=str(uuid.uuid4()),
        trip_id=trip_id,
        creator_id=request.user_id,
        name=data['name'],
        # If category is not provided, default to "Unassigned"
        category=data.get('category', 'Unassigned'),
        latitude=data['latitude'],
        longitude=data['longitude'],
        address=data.get('address'),
        description=data.get('description'),
        website=data.get('website'),
        phone=data.get('phone')
    )
    
    db.session.add(marker)
    db.session.commit()
    
    return jsonify(marker.to_dict()), 201

@map_bp.route('/<trip_id>/markers/<marker_id>', methods=['GET'])
@authenticate_token
@is_trip_member()
def get_marker(trip_id, marker_id):
    """Get a specific map marker"""
    marker = MapMarker.query.filter_by(id=marker_id, trip_id=trip_id).first()
    
    if not marker:
        return jsonify({'error': 'Marker not found'}), 404
    
    return jsonify(marker.to_dict()), 200

@map_bp.route('/<trip_id>/markers/<marker_id>', methods=['PUT'])
@authenticate_token
@is_trip_member()
def update_marker(trip_id, marker_id):
    """Update a map marker"""
    marker = MapMarker.query.filter_by(id=marker_id, trip_id=trip_id).first()
    
    if not marker:
        return jsonify({'error': 'Marker not found'}), 404
    
    # Only allow the creator or a trip planner to update
    trip_member = request.trip_member
    if marker.creator_id != request.user_id and trip_member.role != 'planner':
        return jsonify({'error': 'You do not have permission to update this marker'}), 403
    
    data = request.json
    
    if 'name' in data:
        marker.name = data['name']
    
    if 'category' in data:
        marker.category = data['category']
    
    if 'latitude' in data:
        marker.latitude = data['latitude']
    
    if 'longitude' in data:
        marker.longitude = data['longitude']
    
    if 'address' in data:
        marker.address = data['address']
    
    if 'description' in data:
        marker.description = data['description']
    
    if 'website' in data:
        marker.website = data['website']
    
    if 'phone' in data:
        marker.phone = data['phone']
    
    db.session.commit()
    
    return jsonify(marker.to_dict()), 200

@map_bp.route('/<trip_id>/markers/<marker_id>', methods=['DELETE'])
@authenticate_token
@is_trip_member()
def delete_marker(trip_id, marker_id):
    """Delete a map marker"""
    marker = MapMarker.query.filter_by(id=marker_id, trip_id=trip_id).first()
    
    if not marker:
        return jsonify({'error': 'Marker not found'}), 404
    
    # Only allow the creator or a trip planner to delete
    trip_member = request.trip_member
    if marker.creator_id != request.user_id and trip_member.role != 'planner':
        return jsonify({'error': 'You do not have permission to delete this marker'}), 403
    
    db.session.delete(marker)
    db.session.commit()
    
    return jsonify({'message': 'Marker deleted successfully'}), 200

@map_bp.route('/<trip_id>/categories', methods=['GET'])
@authenticate_token
@is_trip_member()
def get_marker_categories(trip_id):
    """Get all unique categories of markers in a trip"""
    categories = db.session.query(MapMarker.category).filter_by(trip_id=trip_id).distinct().all()
    categories = [c[0] for c in categories]
    
    return jsonify(categories), 200