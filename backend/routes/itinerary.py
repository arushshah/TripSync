from flask import Blueprint, request, jsonify
from db import db
from models.itinerary import ItineraryItem
from models.trip import Trip
from middleware.auth import authenticate_token, is_trip_member
import uuid
import datetime

itinerary_bp = Blueprint('itinerary', __name__)

@itinerary_bp.route('/<trip_id>', methods=['GET'])
@authenticate_token
@is_trip_member()
def get_itinerary(trip_id):
    """Get all itinerary items for a trip"""
    # Get date filter from query params if provided
    date_filter = request.args.get('date')
    
    query = ItineraryItem.query.filter_by(trip_id=trip_id)
    
    if date_filter:
        try:
            filter_date = datetime.datetime.fromisoformat(date_filter).date()
            query = query.filter_by(date=filter_date)
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use ISO format (YYYY-MM-DD)'}), 400
    
    # Order by date and then by start_time
    items = query.order_by(ItineraryItem.date, ItineraryItem.start_time).all()
    
    return jsonify([item.to_dict() for item in items]), 200

@itinerary_bp.route('/<trip_id>', methods=['POST'])
@authenticate_token
@is_trip_member()
def create_itinerary_item(trip_id):
    """Create a new itinerary item"""
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    required_fields = ['date', 'title']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    # Parse date
    try:
        date = datetime.datetime.fromisoformat(data['date']).date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use ISO format (YYYY-MM-DD)'}), 400
    
    # Parse times if provided
    start_time = None
    end_time = None
    
    if 'start_time' in data and data['start_time']:
        try:
            start_time = datetime.datetime.fromisoformat(f"2000-01-01T{data['start_time']}").time()
        except ValueError:
            return jsonify({'error': 'Invalid start_time format. Use ISO format (HH:MM:SS)'}), 400
    
    if 'end_time' in data and data['end_time']:
        try:
            end_time = datetime.datetime.fromisoformat(f"2000-01-01T{data['end_time']}").time()
        except ValueError:
            return jsonify({'error': 'Invalid end_time format. Use ISO format (HH:MM:SS)'}), 400
    
    # Validate if date falls within trip date range
    trip = Trip.query.get(trip_id)
    if date < trip.start_date or date > trip.end_date:
        return jsonify({'error': 'Itinerary item date must be within trip date range'}), 400
    
    item = ItineraryItem(
        id=str(uuid.uuid4()),
        trip_id=trip_id,
        creator_id=request.user_id,
        date=date,
        start_time=start_time,
        end_time=end_time,
        title=data['title'],
        description=data.get('description'),
        location=data.get('location'),
        location_lat=data.get('location_lat'),
        location_lng=data.get('location_lng')
    )
    
    db.session.add(item)
    db.session.commit()
    
    return jsonify(item.to_dict()), 201

@itinerary_bp.route('/<trip_id>/auto-generate', methods=['POST'])
@authenticate_token
@is_trip_member()
def auto_generate_itinerary(trip_id):
    """Auto-generate basic itinerary skeleton from trip dates"""
    trip = Trip.query.get(trip_id)
    
    if not trip:
        return jsonify({'error': 'Trip not found'}), 404
    
    # Check if itinerary items already exist
    existing_items = ItineraryItem.query.filter_by(trip_id=trip_id).count()
    if existing_items > 0:
        return jsonify({'error': 'Itinerary already exists'}), 400
    
    # Create a basic skeleton for each day of the trip
    current_date = trip.start_date
    created_items = []
    
    while current_date <= trip.end_date:
        # Create morning, afternoon, and evening items for each day
        morning = ItineraryItem(
            id=str(uuid.uuid4()),
            trip_id=trip_id,
            creator_id=request.user_id,
            date=current_date,
            start_time=datetime.time(9, 0),
            end_time=datetime.time(12, 0),
            title=f"Morning Activities - Day {(current_date - trip.start_date).days + 1}",
            description="Add your morning plans here"
        )
        
        afternoon = ItineraryItem(
            id=str(uuid.uuid4()),
            trip_id=trip_id,
            creator_id=request.user_id,
            date=current_date,
            start_time=datetime.time(12, 0),
            end_time=datetime.time(17, 0),
            title=f"Afternoon Activities - Day {(current_date - trip.start_date).days + 1}",
            description="Add your afternoon plans here"
        )
        
        evening = ItineraryItem(
            id=str(uuid.uuid4()),
            trip_id=trip_id,
            creator_id=request.user_id,
            date=current_date,
            start_time=datetime.time(17, 0),
            end_time=datetime.time(22, 0),
            title=f"Evening Activities - Day {(current_date - trip.start_date).days + 1}",
            description="Add your evening plans here"
        )
        
        db.session.add_all([morning, afternoon, evening])
        created_items.extend([morning, afternoon, evening])
        
        current_date += datetime.timedelta(days=1)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Itinerary skeleton generated successfully',
        'items': [item.to_dict() for item in created_items]
    }), 201

@itinerary_bp.route('/<trip_id>/<item_id>', methods=['GET'])
@authenticate_token
@is_trip_member()
def get_itinerary_item(trip_id, item_id):
    """Get a specific itinerary item"""
    item = ItineraryItem.query.filter_by(id=item_id, trip_id=trip_id).first()
    
    if not item:
        return jsonify({'error': 'Itinerary item not found'}), 404
    
    return jsonify(item.to_dict()), 200

@itinerary_bp.route('/<trip_id>/<item_id>', methods=['PUT'])
@authenticate_token
@is_trip_member()
def update_itinerary_item(trip_id, item_id):
    """Update an itinerary item"""
    item = ItineraryItem.query.filter_by(id=item_id, trip_id=trip_id).first()
    
    if not item:
        return jsonify({'error': 'Itinerary item not found'}), 404
    
    data = request.json
    
    if 'title' in data:
        item.title = data['title']
    
    if 'description' in data:
        item.description = data['description']
    
    if 'location' in data:
        item.location = data['location']
    
    if 'location_lat' in data:
        item.location_lat = data['location_lat']
    
    if 'location_lng' in data:
        item.location_lng = data['location_lng']
    
    if 'date' in data:
        try:
            date = datetime.datetime.fromisoformat(data['date']).date()
            trip = Trip.query.get(trip_id)
            if date < trip.start_date or date > trip.end_date:
                return jsonify({'error': 'Itinerary item date must be within trip date range'}), 400
            item.date = date
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use ISO format (YYYY-MM-DD)'}), 400
    
    if 'start_time' in data:
        if data['start_time']:
            try:
                item.start_time = datetime.datetime.fromisoformat(f"2000-01-01T{data['start_time']}").time()
            except ValueError:
                return jsonify({'error': 'Invalid start_time format. Use ISO format (HH:MM:SS)'}), 400
        else:
            item.start_time = None
    
    if 'end_time' in data:
        if data['end_time']:
            try:
                item.end_time = datetime.datetime.fromisoformat(f"2000-01-01T{data['end_time']}").time()
            except ValueError:
                return jsonify({'error': 'Invalid end_time format. Use ISO format (HH:MM:SS)'}), 400
        else:
            item.end_time = None
    
    db.session.commit()
    
    return jsonify(item.to_dict()), 200

@itinerary_bp.route('/<trip_id>/<item_id>', methods=['DELETE'])
@authenticate_token
@is_trip_member()
def delete_itinerary_item(trip_id, item_id):
    """Delete an itinerary item"""
    item = ItineraryItem.query.filter_by(id=item_id, trip_id=trip_id).first()
    
    if not item:
        return jsonify({'error': 'Itinerary item not found'}), 404
    
    db.session.delete(item)
    db.session.commit()
    
    return jsonify({'message': 'Itinerary item deleted successfully'}), 200