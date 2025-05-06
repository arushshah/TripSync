from flask import Blueprint, request, jsonify
from db import db
from models.trip import Trip, TripMember
from models.user import User
from middleware.auth import authenticate_token
import datetime
from sqlalchemy import func

rsvp_bp = Blueprint('rsvp', __name__)

@rsvp_bp.route('/join/<invite_token>', methods=['POST'])
@authenticate_token
def join_trip(invite_token):
    """Join a trip using an invite token"""
    # In a production app, you would validate the invite token against stored tokens
    # For now, we'll assume any valid UUID is a valid token and maps to a trip
    
    # Find the trip by invite token (in a real app, this would check a token table)
    # Here, we're just using the trip ID for simplicity
    trip = Trip.query.get(invite_token)
    
    if not trip:
        return jsonify({'error': 'Invalid invite token'}), 404
        
    # Check if user is already a member
    existing_member = TripMember.query.filter_by(
        trip_id=trip.id,
        user_id=request.user_id
    ).first()
    
    if existing_member:
        return jsonify({'error': 'You are already a member of this trip', 'trip': trip.to_dict()}), 400
    
    # Check if trip has a guest limit and if it's reached
    if trip.guest_limit:
        current_going = TripMember.query.filter_by(
            trip_id=trip.id, 
            rsvp_status='going'
        ).count()
        
        if current_going >= trip.guest_limit:
            # Add to waitlist
            max_position = db.session.query(func.max(TripMember.waitlist_position)).filter_by(
                trip_id=trip.id
            ).scalar() or 0
            
            new_member = TripMember(
                trip_id=trip.id,
                user_id=request.user_id,
                role='guest',
                rsvp_status='pending',
                waitlist_position=max_position + 1
            )
            
            db.session.add(new_member)
            db.session.commit()
            
            return jsonify({
                'message': 'Trip is at capacity. You have been added to the waitlist.',
                'trip': trip.to_dict(),
                'waitlist_position': new_member.waitlist_position
            }), 200
    
    # Add user as a trip member
    new_member = TripMember(
        trip_id=trip.id,
        user_id=request.user_id,
        role='guest',
        rsvp_status='pending'
    )
    
    db.session.add(new_member)
    db.session.commit()
    
    return jsonify({
        'message': 'Successfully joined trip',
        'trip': trip.to_dict()
    }), 201

@rsvp_bp.route('/respond', methods=['POST'])
@authenticate_token
def respond_to_invite():
    """Respond to a trip invitation with going/maybe/no"""
    data = request.json
    
    if not data or 'trip_id' not in data or 'response' not in data:
        return jsonify({'error': 'Missing required fields: trip_id and response'}), 400
    
    trip_id = data['trip_id']
    response = data['response']
    
    if response not in ['going', 'maybe', 'no']:
        return jsonify({'error': 'Invalid response. Must be going, maybe, or no'}), 400
    
    # Find the member record
    member = TripMember.query.filter_by(
        trip_id=trip_id,
        user_id=request.user_id
    ).first()
    
    if not member:
        return jsonify({'error': 'You are not invited to this trip'}), 404
    
    trip = Trip.query.get(trip_id)
    
    # Update RSVP status
    member.rsvp_status = response
    
    # Handle waitlist logic if necessary
    if response == 'going' and trip.guest_limit:
        current_going = TripMember.query.filter_by(
            trip_id=trip_id, 
            rsvp_status='going'
        ).count()
        
        if current_going > trip.guest_limit:
            # Calculate waitlist position
            going_members = TripMember.query.filter_by(
                trip_id=trip_id, 
                rsvp_status='going'
            ).order_by(TripMember.updated_at).all()
            
            # Find position in the ordered list
            position = 0
            for i, m in enumerate(going_members):
                if m.user_id == request.user_id:
                    position = i
                    break
            
            # Adjust waitlist position if beyond limit
            if position >= trip.guest_limit:
                member.waitlist_position = position - trip.guest_limit + 1
            else:
                member.waitlist_position = None
    elif response != 'going':
        # Clear waitlist position if not going
        member.waitlist_position = None
    
    db.session.commit()
    
    # If user responded "no", check if anyone can be moved off waitlist
    if response == 'no' and trip.guest_limit:
        going_count = TripMember.query.filter_by(
            trip_id=trip_id, 
            rsvp_status='going',
            waitlist_position=None
        ).count()
        
        if going_count < trip.guest_limit:
            # Find first person on waitlist
            waitlist_member = TripMember.query.filter_by(
                trip_id=trip_id, 
                rsvp_status='going'
            ).filter(TripMember.waitlist_position.isnot(None)).order_by(
                TripMember.waitlist_position
            ).first()
            
            if waitlist_member:
                waitlist_member.waitlist_position = None
                db.session.commit()
    
    return jsonify({
        'message': f'RSVP updated to {response}',
        'waitlist_position': member.waitlist_position
    }), 200

@rsvp_bp.route('/status/<trip_id>', methods=['GET'])
@authenticate_token
def get_rsvp_status(trip_id):
    """Get RSVP status for current user"""
    member = TripMember.query.filter_by(
        trip_id=trip_id,
        user_id=request.user_id
    ).first()
    
    if not member:
        return jsonify({'error': 'You are not a member of this trip'}), 404
    
    return jsonify({
        'status': member.rsvp_status,
        'waitlist_position': member.waitlist_position,
        'role': member.role
    }), 200

@rsvp_bp.route('/summary/<trip_id>', methods=['GET'])
@authenticate_token
def get_rsvp_summary(trip_id):
    """Get summary of RSVPs for a trip"""
    # Check if user is a member of the trip
    member = TripMember.query.filter_by(
        trip_id=trip_id,
        user_id=request.user_id
    ).first()
    
    if not member:
        return jsonify({'error': 'You are not a member of this trip'}), 404
    
    # Count RSVPs by status
    going = TripMember.query.filter_by(trip_id=trip_id, rsvp_status='going').count()
    maybe = TripMember.query.filter_by(trip_id=trip_id, rsvp_status='maybe').count()
    no = TripMember.query.filter_by(trip_id=trip_id, rsvp_status='no').count()
    pending = TripMember.query.filter_by(trip_id=trip_id, rsvp_status='pending').count()
    
    # Count waitlisted people
    waitlist = TripMember.query.filter(
        TripMember.trip_id == trip_id,
        TripMember.waitlist_position.isnot(None)
    ).count()
    
    return jsonify({
        'going': going,
        'maybe': maybe,
        'no': no,
        'pending': pending,
        'waitlist': waitlist,
    }), 200

@rsvp_bp.route('/<trip_id>/update', methods=['POST'])
@authenticate_token
def update_rsvp(trip_id):
    """Update RSVP status for a trip member"""
    data = request.json
    
    if not data or 'status' not in data:
        return jsonify({'error': 'Missing required field: status'}), 400
    
    status = data['status']
    member_id = data.get('member_id')
    
    if status not in ['going', 'maybe', 'not_going', 'pending']:
        return jsonify({'error': 'Invalid status. Must be going, maybe, not_going, or pending'}), 400
    

    member = TripMember.query.filter_by(
        trip_id=trip_id,
        user_id=request.user_id
    ).first()
    
    if not member:
        return jsonify({'error': 'You are not a member of this trip'}), 404
    
    # Map frontend not_going to backend no
    rsvp_status = status
    if status == 'not_going':
        rsvp_status = 'no'
    
    # Update RSVP status
    member.rsvp_status = rsvp_status
    
    # If going, check for guest limit
    trip = Trip.query.get(trip_id)
    
    # Only need to run waitlist logic if the status is 'going'
    if status == 'going' and trip.guest_limit:
        current_going = TripMember.query.filter_by(
            trip_id=trip_id, 
            rsvp_status='going'
        ).filter(TripMember.id != member.id).count()
        
        # +1 for the current member who is going
        if (current_going + 1) > trip.guest_limit:
            # Calculate waitlist position
            max_position = db.session.query(func.max(TripMember.waitlist_position)).filter_by(
                trip_id=trip_id
            ).scalar() or 0
            
            member.waitlist_position = max_position + 1
            waitlisted = True
        else:
            member.waitlist_position = None
            waitlisted = False
    elif status != 'going':
        # Clear waitlist position if not going
        member.waitlist_position = None
        waitlisted = False
    
    member.responded_at = datetime.datetime.utcnow()
    db.session.commit()
    
    # If appropriate, assign appropriate role based on RSVP
    if status == 'going':
        member.role = 'guest'  # Full access
    elif status in ['maybe', 'not_going']:
        member.role = 'viewer'  # Read-only access
    
    db.session.commit()
    
    return jsonify({
        'message': f'RSVP updated to {status}',
        'waitlisted': waitlisted if 'waitlisted' in locals() else False,
        'waitlist_position': member.waitlist_position
    }), 200

@rsvp_bp.route('/<trip_id>', methods=['POST'])
@authenticate_token
def respond_to_invitation(trip_id):
    """Respond to a trip invitation with going/maybe/not_going"""
    data = request.json
    print(request)
    if not data or 'status' not in data:
        return jsonify({'error': 'Missing required field: status'}), 400
    
    status = data['status']
    
    if status not in ['going', 'maybe', 'not_going']:
        return jsonify({'error': 'Invalid status. Must be going, maybe, or not_going'}), 400
    
    # Find the member record
    member = TripMember.query.filter_by(
        trip_id=trip_id,
        user_id=request.user_id
    ).first()
    
    if not member:
        # If member doesn't exist yet, create a new pending member
        member = TripMember(
            trip_id=trip_id,
            user_id=request.user_id,
            role='viewer',  # Default to viewer
            rsvp_status='pending'
        )
        db.session.add(member)
        db.session.commit()
    
    trip = Trip.query.get(trip_id)
    if not trip:
        return jsonify({'error': 'Trip not found'}), 404
    
    # Map frontend not_going to backend no
    rsvp_status = 'no' if status == 'not_going' else status
    
    # Update RSVP status
    member.rsvp_status = rsvp_status
    
    # Set appropriate role based on RSVP status
    if status == 'going':
        member.role = 'guest'  # Full access
    elif status in ['maybe', 'not_going']:
        member.role = 'viewer'  # Read-only access
        
    # Handle waitlist logic for "going" responses
    waitlisted = False
    if status == 'going' and trip.guest_limit:
        current_going = TripMember.query.filter_by(
            trip_id=trip_id, 
            rsvp_status='going'
        ).filter(TripMember.id != member.id).count()
        
        # +1 for the current member who is going
        if (current_going + 1) > trip.guest_limit:
            # Calculate waitlist position
            max_position = db.session.query(func.max(TripMember.waitlist_position)).filter_by(
                trip_id=trip_id
            ).scalar() or 0
            
            member.waitlist_position = max_position + 1
            waitlisted = True
        else:
            member.waitlist_position = None
    elif status != 'going':
        # Clear waitlist position if not going
        member.waitlist_position = None
    
    member.responded_at = datetime.datetime.utcnow()
    db.session.commit()
    
    # If user responded "no", check if anyone can be moved off waitlist
    if status == 'not_going' and trip.guest_limit:
        going_count = TripMember.query.filter_by(
            trip_id=trip_id, 
            rsvp_status='going',
            waitlist_position=None
        ).count()
        
        if going_count < trip.guest_limit:
            # Find first person on waitlist
            waitlist_member = TripMember.query.filter_by(
                trip_id=trip_id, 
                rsvp_status='going'
            ).filter(TripMember.waitlist_position.isnot(None)).order_by(
                TripMember.waitlist_position
            ).first()
            
            if waitlist_member:
                waitlist_member.waitlist_position = None
                db.session.commit()
    
    return jsonify({
        'message': f'RSVP updated to {status}',
        'waitlisted': waitlisted,
        'waitlist_position': member.waitlist_position
    }), 200