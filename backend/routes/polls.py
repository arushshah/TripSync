from flask import Blueprint, request, jsonify
from db import db
from models.poll import Poll, PollOption, PollVote
from middleware.auth import authenticate_token, is_trip_member
import uuid
import datetime

polls_bp = Blueprint('polls', __name__)

@polls_bp.route('/<trip_id>', methods=['GET'])
@authenticate_token
@is_trip_member()
def get_polls(trip_id):
    """Get all polls for a trip"""
    polls = Poll.query.filter_by(trip_id=trip_id).order_by(Poll.created_at.desc()).all()
    
    include_votes = request.args.get('include_votes', 'false').lower() == 'true'
    
    return jsonify([poll.to_dict(include_options=True, include_votes=include_votes) for poll in polls]), 200

@polls_bp.route('/<trip_id>', methods=['POST'])
@authenticate_token
@is_trip_member()
def create_poll(trip_id):
    """Create a new poll"""
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    if 'question' not in data:
        return jsonify({'error': 'Question is required'}), 400
    
    if 'options' not in data or not isinstance(data['options'], list) or len(data['options']) < 2:
        return jsonify({'error': 'At least two options are required'}), 400
    
    # Parse end_date if provided
    end_date = None
    if 'end_date' in data and data['end_date']:
        try:
            end_date = datetime.datetime.fromisoformat(data['end_date'])
        except ValueError:
            return jsonify({'error': 'Invalid end_date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)'}), 400
    
    # Create the poll
    poll = Poll(
        id=str(uuid.uuid4()),
        trip_id=trip_id,
        creator_id=request.user_id,
        question=data['question'],
        description=data.get('description'),
        end_date=end_date,
        allow_multiple=data.get('allow_multiple', False)
    )
    
    db.session.add(poll)
    
    # Create the options
    options = []
    for option_text in data['options']:
        option = PollOption(
            id=str(uuid.uuid4()),
            poll_id=poll.id,
            text=option_text
        )
        db.session.add(option)
        options.append(option)
    
    db.session.commit()
    
    return jsonify(poll.to_dict(include_options=True)), 201

@polls_bp.route('/<trip_id>/<poll_id>', methods=['GET'])
@authenticate_token
@is_trip_member()
def get_poll(trip_id, poll_id):
    """Get a specific poll"""
    poll = Poll.query.filter_by(id=poll_id, trip_id=trip_id).first()
    
    if not poll:
        return jsonify({'error': 'Poll not found'}), 404
    
    include_votes = request.args.get('include_votes', 'false').lower() == 'true'
    
    return jsonify(poll.to_dict(include_options=True, include_votes=include_votes)), 200

@polls_bp.route('/<trip_id>/<poll_id>', methods=['PUT'])
@authenticate_token
@is_trip_member()
def update_poll(trip_id, poll_id):
    """Update a poll (only before any votes are cast)"""
    poll = Poll.query.filter_by(id=poll_id, trip_id=trip_id).first()
    
    if not poll:
        return jsonify({'error': 'Poll not found'}), 404
    
    # Only allow the creator or a trip planner to update
    trip_member = request.trip_member
    if poll.creator_id != request.user_id and trip_member.role != 'planner':
        return jsonify({'error': 'You do not have permission to update this poll'}), 403
    
    # Check if there are any votes
    has_votes = db.session.query(PollVote).join(PollOption).filter(PollOption.poll_id == poll_id).first() is not None
    if has_votes:
        return jsonify({'error': 'Cannot update poll after votes have been cast'}), 400
    
    data = request.json
    
    if 'question' in data:
        poll.question = data['question']
    
    if 'description' in data:
        poll.description = data['description']
    
    if 'end_date' in data:
        if data['end_date']:
            try:
                poll.end_date = datetime.datetime.fromisoformat(data['end_date'])
            except ValueError:
                return jsonify({'error': 'Invalid end_date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)'}), 400
        else:
            poll.end_date = None
    
    if 'allow_multiple' in data:
        poll.allow_multiple = data['allow_multiple']
    
    # Update options if provided
    if 'options' in data:
        if not isinstance(data['options'], list) or len(data['options']) < 2:
            return jsonify({'error': 'At least two options are required'}), 400
        
        # Delete existing options
        for option in poll.options:
            db.session.delete(option)
        
        # Create new options
        for option_text in data['options']:
            option = PollOption(
                id=str(uuid.uuid4()),
                poll_id=poll.id,
                text=option_text
            )
            db.session.add(option)
    
    db.session.commit()
    
    return jsonify(poll.to_dict(include_options=True)), 200

@polls_bp.route('/<trip_id>/<poll_id>', methods=['DELETE'])
@authenticate_token
@is_trip_member()
def delete_poll(trip_id, poll_id):
    """Delete a poll"""
    poll = Poll.query.filter_by(id=poll_id, trip_id=trip_id).first()
    
    if not poll:
        return jsonify({'error': 'Poll not found'}), 404
    
    # Only allow the creator or a trip planner to delete
    trip_member = request.trip_member
    if poll.creator_id != request.user_id and trip_member.role != 'planner':
        return jsonify({'error': 'You do not have permission to delete this poll'}), 403
    
    db.session.delete(poll)
    db.session.commit()
    
    return jsonify({'message': 'Poll deleted successfully'}), 200

@polls_bp.route('/<trip_id>/<poll_id>/vote', methods=['POST'])
@authenticate_token
@is_trip_member()
def vote(trip_id, poll_id):
    """Vote on a poll"""
    data = request.json
    
    if not data or 'option_ids' not in data:
        return jsonify({'error': 'option_ids are required'}), 400
    
    option_ids = data['option_ids']
    if not isinstance(option_ids, list) or len(option_ids) == 0:
        return jsonify({'error': 'option_ids must be a non-empty list'}), 400
    
    poll = Poll.query.filter_by(id=poll_id, trip_id=trip_id).first()
    if not poll:
        return jsonify({'error': 'Poll not found'}), 404
    
    # Check if poll has ended
    if poll.end_date and poll.end_date < datetime.datetime.now():
        return jsonify({'error': 'Poll has ended'}), 400
    
    # Check if multiple options are allowed
    if len(option_ids) > 1 and not poll.allow_multiple:
        return jsonify({'error': 'This poll does not allow multiple votes'}), 400
    
    # Verify all options belong to the poll
    for option_id in option_ids:
        option = PollOption.query.filter_by(id=option_id, poll_id=poll_id).first()
        if not option:
            return jsonify({'error': f'Option with id {option_id} not found or does not belong to this poll'}), 404
    
    # Delete existing votes by this user on this poll
    existing_votes = db.session.query(PollVote).join(PollOption).filter(
        PollOption.poll_id == poll_id,
        PollVote.user_id == request.user_id
    ).all()
    
    for vote in existing_votes:
        db.session.delete(vote)
    
    # Create new votes
    for option_id in option_ids:
        vote = PollVote(
            option_id=option_id,
            user_id=request.user_id
        )
        db.session.add(vote)
    
    db.session.commit()
    
    return jsonify({'message': 'Vote recorded successfully'}), 200

@polls_bp.route('/<trip_id>/<poll_id>/my-vote', methods=['GET'])
@authenticate_token
@is_trip_member()
def get_my_vote(trip_id, poll_id):
    """Get the current user's votes on a poll"""
    poll = Poll.query.filter_by(id=poll_id, trip_id=trip_id).first()
    
    if not poll:
        return jsonify({'error': 'Poll not found'}), 404
    
    votes = db.session.query(PollVote).join(PollOption).filter(
        PollOption.poll_id == poll_id,
        PollVote.user_id == request.user_id
    ).all()
    
    option_ids = [vote.option_id for vote in votes]
    
    return jsonify({
        'poll_id': poll_id,
        'option_ids': option_ids,
        'has_voted': len(option_ids) > 0
    }), 200