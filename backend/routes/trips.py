from flask import Blueprint, request, jsonify, current_app
from db import db
from models.trip import Trip, TripMember
from models.user import User
from middleware.auth import authenticate_token, is_trip_member
import datetime
import uuid

trips_bp = Blueprint('trips', __name__)

@trips_bp.route('/', methods=['GET'])
@authenticate_token
def get_trips():
    """Get all trips for the current user where they've RSVP'd as going"""
    user_id = request.user_id
    
    # Find all trips where the user is "going"
    going_members = TripMember.query.filter_by(
        user_id=user_id, 
        rsvp_status='going'
    ).all()
    
    trip_ids = [tm.trip_id for tm in going_members]
    trips = Trip.query.filter(Trip.id.in_(trip_ids)).all()
    
    return jsonify([trip.to_dict() for trip in trips]), 200

@trips_bp.route('/', methods=['POST'])
@authenticate_token
def create_trip():
    """Create a new trip"""
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
        
    required_fields = ['name', 'start_date', 'end_date']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
            
    # Parse dates
    try:
        start_date = datetime.datetime.fromisoformat(data['start_date']).date()
        end_date = datetime.datetime.fromisoformat(data['end_date']).date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use ISO format (YYYY-MM-DD)'}), 400
        
    if start_date > end_date:
        return jsonify({'error': 'Start date cannot be after end date'}), 400
        
    # Create the trip
    trip = Trip(
        id=str(uuid.uuid4()),
        name=data['name'],
        description=data.get('description'),
        location=data.get('location'),
        start_date=start_date,
        end_date=end_date,
        guest_limit=data.get('guest_limit'),
        creator_id=request.user_id
    )
    
    db.session.add(trip)
    
    # Add the creator as a planner
    trip_member = TripMember(
        trip_id=trip.id,
        user_id=request.user_id,
        role='planner',
        rsvp_status='going'
    )
    
    db.session.add(trip_member)
    db.session.commit()
    
    return jsonify(trip.to_dict(include_members=True)), 201

@trips_bp.route('/<trip_id>', methods=['GET'])
@authenticate_token
@is_trip_member()
def get_trip(trip_id):
    """Get a specific trip"""
    trip = Trip.query.get(trip_id)
    
    if not trip:
        return jsonify({'error': 'Trip not found'}), 404
        
    return jsonify(trip.to_dict(include_members=True)), 200

@trips_bp.route('/<trip_id>', methods=['PUT'])
@authenticate_token
@is_trip_member(role='planner')
def update_trip(trip_id):
    """Update a trip (requires planner role)"""
    trip = Trip.query.get(trip_id)
    
    if not trip:
        return jsonify({'error': 'Trip not found'}), 404
        
    data = request.json
    
    if 'name' in data:
        trip.name = data['name']
        
    if 'description' in data:
        trip.description = data['description']
        
    if 'location' in data:
        trip.location = data['location']
        
    if 'start_date' in data:
        try:
            trip.start_date = datetime.datetime.fromisoformat(data['start_date']).date()
        except ValueError:
            return jsonify({'error': 'Invalid start date format. Use ISO format (YYYY-MM-DD)'}), 400
            
    if 'end_date' in data:
        try:
            trip.end_date = datetime.datetime.fromisoformat(data['end_date']).date()
        except ValueError:
            return jsonify({'error': 'Invalid end date format. Use ISO format (YYYY-MM-DD)'}), 400
            
    if 'guest_limit' in data:
        trip.guest_limit = data['guest_limit']
        
    if trip.start_date > trip.end_date:
        return jsonify({'error': 'Start date cannot be after end date'}), 400
        
    db.session.commit()
    
    return jsonify(trip.to_dict()), 200

@trips_bp.route('/<trip_id>', methods=['DELETE'])
@authenticate_token
@is_trip_member(role='planner')
def delete_trip(trip_id):
    """Delete a trip (requires planner role)"""
    trip = Trip.query.get(trip_id)
    
    if not trip:
        return jsonify({'error': 'Trip not found'}), 404
        
    db.session.delete(trip)
    db.session.commit()
    
    return jsonify({'message': 'Trip deleted successfully'}), 200

@trips_bp.route('/<trip_id>/invite', methods=['POST'])
@authenticate_token
@is_trip_member(role='planner')
def create_invite(trip_id):
    """Generate an invite link for a trip (requires planner role)"""
    # Generate a unique invite token
    invite_token = str(uuid.uuid4())
    
    # In a production app, you would store this token in the database
    # For now, we'll just return it
    invite_url = f"{request.host_url}trips/invite/{invite_token}"
    
    return jsonify({
        'invite_url': invite_url,
        'invite_token': invite_token
    }), 200

@trips_bp.route('/<trip_id>/invite-info', methods=['GET'])
@authenticate_token
def get_trip_invite_info(trip_id):
    """Get information about a trip for invitation purposes"""
    # Find the trip
    trip = Trip.query.get(trip_id)
    
    if not trip:
        return jsonify({'error': 'Trip not found'}), 404
    
    # Check if the user already has a response to this invitation
    member = TripMember.query.filter_by(
        trip_id=trip_id,
        user_id=request.user_id
    ).first()
    
    response_data = {
        'trip': trip.to_dict(),
        'user_response': member.to_dict() if member else None
    }
    
    # If the user is not already a member, add them with pending status
    if not member:
        new_member = TripMember(
            trip_id=trip_id,
            user_id=request.user_id,
            role='viewer',  # Default to viewer until they respond
            rsvp_status='pending'
        )
        db.session.add(new_member)
        db.session.commit()
    
    return jsonify(response_data), 200

@trips_bp.route('/<trip_id>/members', methods=['GET'])
@authenticate_token
@is_trip_member()
def get_trip_members(trip_id):
    """Get all members of a trip"""
    members = TripMember.query.filter_by(trip_id=trip_id).all()
    
    return jsonify([member.to_dict() for member in members]), 200

@trips_bp.route('/<trip_id>/members/<user_id>', methods=['PUT'])
@authenticate_token
@is_trip_member(role='planner')
def update_trip_member(trip_id, user_id):
    """Update a member's role or status (requires planner role)"""
    member = TripMember.query.filter_by(trip_id=trip_id, user_id=user_id).first()
    
    if not member:
        return jsonify({'error': 'Trip member not found'}), 404
        
    data = request.json
    
    if 'role' in data:
        if data['role'] not in ['planner', 'guest', 'viewer']:
            return jsonify({'error': 'Invalid role. Must be planner, guest, or viewer'}), 400
        member.role = data['role']
        
    if 'rsvp_status' in data:
        if data['rsvp_status'] not in ['going', 'maybe', 'not_going', 'pending']:
            return jsonify({'error': 'Invalid RSVP status. Must be going, maybe, no, or pending'}), 400
        member.rsvp_status = data['rsvp_status']
        
    db.session.commit()
    
    return jsonify(member.to_dict()), 200

@trips_bp.route('/<trip_id>/members/<user_id>', methods=['DELETE'])
@authenticate_token
@is_trip_member(role='planner')
def remove_trip_member(trip_id, user_id):
    """Remove a member from a trip (requires planner role)"""
    member = TripMember.query.filter_by(trip_id=trip_id, user_id=user_id).first()
    
    if not member:
        return jsonify({'error': 'Trip member not found'}), 404
        
    db.session.delete(member)
    db.session.commit()
    
    return jsonify({'message': 'Member removed successfully'}), 200

@trips_bp.route('/invitations', methods=['GET'])
@authenticate_token
def get_trip_invitations():
    """Get all trip invitations for the current user (all RSVP statuses except 'going')"""
    user_id = request.user_id
    
    # Find all trips where the user is a member with any status except "going"
    non_going_members = TripMember.query.filter(
        TripMember.user_id == user_id,
        TripMember.rsvp_status.in_(['pending', 'maybe', 'not_going'])
    ).all()
    
    trip_ids = [tm.trip_id for tm in non_going_members]
    trips = Trip.query.filter(Trip.id.in_(trip_ids)).all()
    
    return jsonify([trip.to_dict() for trip in trips]), 200