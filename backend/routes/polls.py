from flask import Blueprint, request, jsonify
from models.poll import Poll, PollOption, PollVote
from models.trip import Trip
from models.user import User
from db import db
from middleware.auth import authenticate_token, check_trip_access
from sqlalchemy.exc import SQLAlchemyError
import datetime

polls_bp = Blueprint('polls', __name__)

@polls_bp.route('/<trip_id>', methods=['GET'])
@authenticate_token
def get_polls(trip_id):
    """Get all polls for a trip"""
    # Check if user has access to this trip
    trip_access = check_trip_access(request.user_id, trip_id)
    if not trip_access:
        return jsonify({'error': 'You do not have access to this trip'}), 403
    
    try:
        # Get all polls for this trip, with their options and votes
        polls = Poll.query.filter_by(trip_id=trip_id).all()
        
        # Convert to dictionary with options and votes
        polls_data = []
        for poll in polls:
            poll_dict = poll.to_dict(include_options=True, include_votes=True)
            polls_data.append(poll_dict)
            
        # Always return the polls_data array (even if empty)
        return jsonify(polls_data), 200
    
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@polls_bp.route('/<trip_id>', methods=['POST'])
@authenticate_token
def create_poll(trip_id):
    """Create a new poll for a trip"""
    # Check if user has access to this trip
    trip_access = check_trip_access(request.user_id, trip_id)
    if not trip_access or trip_access.role != 'planner':
        return jsonify({'error': 'You must be the trip planner to create polls'}), 403
    
    data = request.get_json()
    
    # Validate required fields
    if not data or 'question' not in data or 'options' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    if not data['options'] or len(data['options']) < 2:
        return jsonify({'error': 'At least 2 options are required'}), 400
    
    try:
        # Create the poll
        new_poll = Poll(
            trip_id=trip_id,
            creator_id=request.user_id,
            question=data['question'],
            description=data.get('description'),
            end_date=datetime.datetime.fromisoformat(data['end_date']) if data.get('end_date') else None,
            allow_multiple=data.get('allow_multiple', False)
        )
        
        db.session.add(new_poll)
        db.session.flush()  # Flush to get the ID without committing
        
        # Create the options
        for option_text in data['options']:
            option = PollOption(
                poll_id=new_poll.id,
                text=option_text
            )
            db.session.add(option)
        
        db.session.commit()
        
        # Return the created poll with its options
        return jsonify(new_poll.to_dict(include_options=True)), 201
    
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@polls_bp.route('/<trip_id>/<poll_id>', methods=['GET'])
@authenticate_token
def get_poll(trip_id, poll_id):
    """Get a specific poll with its options and votes"""
    # Check if user has access to this trip
    trip_access = check_trip_access(request.user_id, trip_id)
    if not trip_access:
        return jsonify({'error': 'You do not have access to this trip'}), 403
    
    try:
        poll = Poll.query.filter_by(id=poll_id, trip_id=trip_id).first()
        if not poll:
            return jsonify({'error': 'Poll not found'}), 404
        
        # Return poll with options and votes
        return jsonify(poll.to_dict(include_options=True, include_votes=True)), 200
    
    except SQLAlchemyError as e:
        return jsonify({'error': str(e)}), 500


@polls_bp.route('/<trip_id>/<poll_id>', methods=['PUT'])
@authenticate_token
def update_poll(trip_id, poll_id):
    """Update a poll"""
    # Check if user has access to this trip and is the planner
    trip_access = check_trip_access(request.user_id, trip_id)
    if not trip_access or trip_access.role != 'planner':
        return jsonify({'error': 'You must be the trip planner to update polls'}), 403
    
    data = request.get_json()
    
    # Validate required fields
    if not data or 'question' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    try:
        poll = Poll.query.filter_by(id=poll_id, trip_id=trip_id).first()
        if not poll:
            return jsonify({'error': 'Poll not found'}), 404
        
        # Update poll fields
        poll.question = data['question']
        poll.description = data.get('description')
        poll.end_date = datetime.datetime.fromisoformat(data['end_date']) if data.get('end_date') else None
        poll.allow_multiple = data.get('allow_multiple', poll.allow_multiple)
        
        # Handle options update if provided
        if 'options' in data and isinstance(data['options'], list):
            # If there are votes already cast, we shouldn't modify options
            votes_count = sum(len(option.votes) for option in poll.options)
            if votes_count > 0:
                return jsonify({'error': 'Cannot modify poll options after votes have been cast'}), 400
            
            # Delete existing options
            for option in poll.options:
                db.session.delete(option)
            
            # Create new options
            for option_text in data['options']:
                option = PollOption(
                    poll_id=poll.id,
                    text=option_text
                )
                db.session.add(option)
        
        db.session.commit()
        
        # Return the updated poll
        return jsonify(poll.to_dict(include_options=True)), 200
    
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@polls_bp.route('/<trip_id>/<poll_id>', methods=['DELETE'])
@authenticate_token
def delete_poll(trip_id, poll_id):
    """Delete a poll"""
    # Check if user has access to this trip and is the planner
    trip_access = check_trip_access(request.user_id, trip_id)
    if not trip_access or trip_access.role != 'planner':
        return jsonify({'error': 'You must be the trip planner to delete polls'}), 403
    
    try:
        poll = Poll.query.filter_by(id=poll_id, trip_id=trip_id).first()
        if not poll:
            return jsonify({'error': 'Poll not found'}), 404
        
        # Delete the poll (cascade will delete options and votes)
        db.session.delete(poll)
        db.session.commit()
        
        return jsonify({'message': 'Poll deleted successfully'}), 200
    
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@polls_bp.route('/<trip_id>/<poll_id>/vote', methods=['POST'])
@authenticate_token
def vote_on_poll(trip_id, poll_id):
    """Vote on a poll"""
    # Check if user has access to this trip
    trip_access = check_trip_access(request.user_id, trip_id)
    if not trip_access:
        return jsonify({'error': 'You do not have access to this trip'}), 403
    
    # Check if the poll exists
    poll = Poll.query.filter_by(id=poll_id, trip_id=trip_id).first()
    if not poll:
        return jsonify({'error': 'Poll not found'}), 404
    
    # Check if the poll has expired
    if poll.end_date and poll.end_date < datetime.datetime.now(datetime.timezone.utc):
        return jsonify({'error': 'This poll has ended'}), 400
    
    data = request.get_json()
    if not data or 'optionIds' not in data or not isinstance(data['optionIds'], list):
        return jsonify({'error': 'Missing option IDs'}), 400
    
    option_ids = data['optionIds']
    if not option_ids:
        return jsonify({'error': 'No option IDs provided'}), 400
    
    # If multiple votes aren't allowed, ensure only one option is selected
    if not poll.allow_multiple and len(option_ids) > 1:
        return jsonify({'error': 'This poll only allows one choice'}), 400
    
    try:
        # Delete any existing votes from this user on this poll's options
        existing_votes = PollVote.query.join(PollOption).filter(
            PollOption.poll_id == poll_id,
            PollVote.user_id == request.user_id
        ).all()
        
        for vote in existing_votes:
            db.session.delete(vote)
        
        # Create new votes
        for option_id in option_ids:
            # Verify the option belongs to this poll
            option = PollOption.query.filter_by(id=option_id, poll_id=poll_id).first()
            if not option:
                return jsonify({'error': f'Option {option_id} not found in this poll'}), 404
            
            # Create the vote
            vote = PollVote(
                option_id=option_id,
                user_id=request.user_id
            )
            db.session.add(vote)
        
        db.session.commit()
        
        # Return the updated poll with votes
        poll = Poll.query.filter_by(id=poll_id).first()
        return jsonify(poll.to_dict(include_options=True, include_votes=True)), 200
    
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500