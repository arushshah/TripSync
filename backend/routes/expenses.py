from flask import Blueprint, request, jsonify
from db import db
from models.expense import Expense, ExpenseParticipant
from models.trip import TripMember
from middleware.auth import authenticate_token, is_trip_member
import uuid
import datetime
from sqlalchemy import func
from decimal import Decimal

expenses_bp = Blueprint('expenses', __name__)

@expenses_bp.route('/<trip_id>', methods=['GET'])
@authenticate_token
@is_trip_member()
def get_expenses(trip_id):
    """Get all expenses for a trip"""
    expenses = Expense.query.filter_by(trip_id=trip_id).order_by(Expense.date.desc()).all()
    
    return jsonify([expense.to_dict(include_participants=True) for expense in expenses]), 200

@expenses_bp.route('/<trip_id>', methods=['POST'])
@authenticate_token
@is_trip_member()
def create_expense(trip_id):
    """Create a new expense"""
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    required_fields = ['title', 'amount', 'currency', 'date']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    # Parse date
    try:
        date = datetime.datetime.fromisoformat(data['date']).date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use ISO format (YYYY-MM-DD)'}), 400
    
    # Create the expense
    expense = Expense(
        id=str(uuid.uuid4()),
        trip_id=trip_id,
        creator_id=request.user_id,
        title=data['title'],
        amount=data['amount'],
        currency=data['currency'],
        date=date,
        category=data.get('category'),
        description=data.get('description'),
        receipt_url=data.get('receipt_url')
    )
    
    db.session.add(expense)
    
    # Create expense participants
    participants = data.get('participants', [])
    
    if not participants:
        # If no participants specified, split evenly among all trip members who are 'going'
        trip_members = TripMember.query.filter_by(
            trip_id=trip_id,
            rsvp_status='going'
        ).all()
        
        total_members = len(trip_members)
        if total_members > 0:
            share_amount = Decimal(data['amount']) / total_members
            
            for member in trip_members:
                participant = ExpenseParticipant(
                    expense_id=expense.id,
                    user_id=member.user_id,
                    share_amount=share_amount,
                    paid=member.user_id == request.user_id  # Assume creator has paid
                )
                db.session.add(participant)
    else:
        # Add specified participants
        total_share = sum(p.get('share', 0) for p in participants)
        
        if total_share != float(data['amount']):
            return jsonify({'error': 'Sum of participant shares must equal the total amount'}), 400
        
        for p in participants:
            if 'user_id' not in p or 'share' not in p:
                return jsonify({'error': 'Participant must have user_id and share'}), 400
            
            participant = ExpenseParticipant(
                expense_id=expense.id,
                user_id=p['user_id'],
                share_amount=p['share'],
                paid=p.get('paid', False)
            )
            db.session.add(participant)
    
    db.session.commit()
    
    return jsonify(expense.to_dict(include_participants=True)), 201

@expenses_bp.route('/<trip_id>/<expense_id>', methods=['GET'])
@authenticate_token
@is_trip_member()
def get_expense(trip_id, expense_id):
    """Get a specific expense"""
    expense = Expense.query.filter_by(id=expense_id, trip_id=trip_id).first()
    
    if not expense:
        return jsonify({'error': 'Expense not found'}), 404
    
    return jsonify(expense.to_dict(include_participants=True)), 200

@expenses_bp.route('/<trip_id>/<expense_id>', methods=['PUT'])
@authenticate_token
@is_trip_member()
def update_expense(trip_id, expense_id):
    """Update an expense"""
    expense = Expense.query.filter_by(id=expense_id, trip_id=trip_id).first()
    
    if not expense:
        return jsonify({'error': 'Expense not found'}), 404
    
    # Only allow the expense creator or a trip planner to update
    trip_member = request.trip_member
    if expense.creator_id != request.user_id and trip_member.role != 'planner':
        return jsonify({'error': 'You do not have permission to update this expense'}), 403
    
    data = request.json
    
    if 'title' in data:
        expense.title = data['title']
    
    if 'description' in data:
        expense.description = data['description']
    
    if 'category' in data:
        expense.category = data['category']
    
    if 'amount' in data:
        # Updating amount requires recalculating participant shares
        if 'participants' not in data:
            return jsonify({'error': 'Participants must be provided when updating amount'}), 400
        expense.amount = data['amount']
    
    if 'currency' in data:
        expense.currency = data['currency']
    
    if 'date' in data:
        try:
            expense.date = datetime.datetime.fromisoformat(data['date']).date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use ISO format (YYYY-MM-DD)'}), 400
    
    if 'receipt_url' in data:
        expense.receipt_url = data['receipt_url']
    
    # Update participants if provided
    if 'participants' in data:
        # Delete existing participants
        ExpenseParticipant.query.filter_by(expense_id=expense_id).delete()
        
        # Add updated participants
        participants = data['participants']
        total_share = sum(p.get('share', 0) for p in participants)
        
        if total_share != float(expense.amount):
            return jsonify({'error': 'Sum of participant shares must equal the total amount'}), 400
        
        for p in participants:
            if 'user_id' not in p or 'share' not in p:
                return jsonify({'error': 'Participant must have user_id and share'}), 400
            
            participant = ExpenseParticipant(
                expense_id=expense.id,
                user_id=p['user_id'],
                share_amount=p['share'],
                paid=p.get('paid', False)
            )
            db.session.add(participant)
    
    db.session.commit()
    
    return jsonify(expense.to_dict(include_participants=True)), 200

@expenses_bp.route('/<trip_id>/<expense_id>', methods=['DELETE'])
@authenticate_token
@is_trip_member()
def delete_expense(trip_id, expense_id):
    """Delete an expense"""
    expense = Expense.query.filter_by(id=expense_id, trip_id=trip_id).first()
    
    if not expense:
        return jsonify({'error': 'Expense not found'}), 404
    
    # Only allow the expense creator or a trip planner to delete
    trip_member = request.trip_member
    if expense.creator_id != request.user_id and trip_member.role != 'planner':
        return jsonify({'error': 'You do not have permission to delete this expense'}), 403
    
    db.session.delete(expense)
    db.session.commit()
    
    return jsonify({'message': 'Expense deleted successfully'}), 200

@expenses_bp.route('/<trip_id>/summary', methods=['GET'])
@authenticate_token
@is_trip_member()
def get_expense_summary(trip_id):
    """Get a summary of expenses for a trip"""
    # Get all expenses for the trip
    expenses = Expense.query.filter_by(trip_id=trip_id).all()
    
    # Get all trip members
    trip_members = TripMember.query.filter_by(trip_id=trip_id).all()
    
    # Calculate total expenses
    total_amount = sum(float(expense.amount) for expense in expenses)
    
    # Calculate amounts paid and owed by each user
    user_balances = {}
    for member in trip_members:
        user_id = member.user_id
        user_balances[user_id] = {
            'user_id': user_id,
            'paid': 0.0,
            'owed': 0.0,
            'net': 0.0
        }
    
    # Calculate what each user paid and owes
    for expense in expenses:
        # Add what the creator paid
        if expense.creator_id in user_balances:
            user_balances[expense.creator_id]['paid'] += float(expense.amount)
        
        # Add what each participant owes
        for participant in expense.participants:
            if participant.user_id in user_balances:
                user_balances[participant.user_id]['owed'] += float(participant.share_amount)
    
    # Calculate net balance for each user
    for user_id, balance in user_balances.items():
        balance['net'] = balance['paid'] - balance['owed']
    
    # Generate list of settlements (who pays whom)
    settlements = []
    creditors = [u for u in user_balances.values() if u['net'] > 0]
    debtors = [u for u in user_balances.values() if u['net'] < 0]
    
    # Sort by absolute value of net balance (largest first)
    creditors.sort(key=lambda x: x['net'], reverse=True)
    debtors.sort(key=lambda x: x['net'])
    
    # Calculate settlements
    for debtor in debtors:
        debt_remaining = -debtor['net']
        
        for creditor in creditors:
            if creditor['net'] <= 0:
                continue
            
            amount = min(debt_remaining, creditor['net'])
            if amount > 0:
                settlements.append({
                    'from_user_id': debtor['user_id'],
                    'to_user_id': creditor['user_id'],
                    'amount': round(amount, 2)
                })
                
                creditor['net'] -= amount
                debt_remaining -= amount
                
                if debt_remaining <= 0:
                    break
    
    return jsonify({
        'total_expenses': total_amount,
        'users': list(user_balances.values()),
        'settlements': settlements,
        'expense_count': len(expenses),
        'currency': expenses[0].currency if expenses else 'USD'
    }), 200

@expenses_bp.route('/<trip_id>/my-expenses', methods=['GET'])
@authenticate_token
@is_trip_member()
def get_my_expenses(trip_id):
    """Get expenses created by or involving the current user"""
    # Get expenses created by the user
    created_expenses = Expense.query.filter_by(
        trip_id=trip_id,
        creator_id=request.user_id
    ).all()
    
    # Get expenses where user is a participant
    participant_expense_ids = db.session.query(ExpenseParticipant.expense_id).filter_by(
        user_id=request.user_id
    ).all()
    
    participant_expense_ids = [id[0] for id in participant_expense_ids]
    participant_expenses = Expense.query.filter(
        Expense.trip_id == trip_id,
        Expense.id.in_(participant_expense_ids),
        Expense.creator_id != request.user_id  # Exclude already counted expenses
    ).all()
    
    all_expenses = created_expenses + participant_expenses
    all_expenses.sort(key=lambda x: x.date, reverse=True)
    
    return jsonify([expense.to_dict(include_participants=True) for expense in all_expenses]), 200

@expenses_bp.route('/<trip_id>/participants/<expense_id>/<user_id>/mark-paid', methods=['POST'])
@authenticate_token
@is_trip_member()
def mark_participant_paid(trip_id, expense_id, user_id):
    """Mark a participant as having paid their share"""
    expense = Expense.query.filter_by(id=expense_id, trip_id=trip_id).first()
    
    if not expense:
        return jsonify({'error': 'Expense not found'}), 404
    
    # Only allow the expense creator or a trip planner to update
    trip_member = request.trip_member
    if expense.creator_id != request.user_id and trip_member.role != 'planner':
        return jsonify({'error': 'You do not have permission to update this expense'}), 403
    
    participant = ExpenseParticipant.query.filter_by(
        expense_id=expense_id,
        user_id=user_id
    ).first()
    
    if not participant:
        return jsonify({'error': 'Participant not found'}), 404
    
    participant.paid = True
    db.session.commit()
    
    return jsonify({
        'message': 'Participant marked as paid',
        'participant': participant.to_dict()
    }), 200