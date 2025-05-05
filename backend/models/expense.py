from db import db
from sqlalchemy.sql import func
import uuid

class Expense(db.Model):
    __tablename__ = 'expenses'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    trip_id = db.Column(db.String(36), db.ForeignKey('trips.id'), nullable=False)
    creator_id = db.Column(db.String(40), db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    currency = db.Column(db.String(3), nullable=False)
    date = db.Column(db.Date, nullable=False)
    category = db.Column(db.String(50), nullable=True)
    receipt_url = db.Column(db.String(500), nullable=True)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    trip = db.relationship('Trip', back_populates='expenses')
    creator = db.relationship('User', back_populates='expenses')
    participants = db.relationship('ExpenseParticipant', back_populates='expense', cascade='all, delete-orphan')
    
    def to_dict(self, include_participants=False):
        expense_dict = {
            'id': self.id,
            'trip_id': self.trip_id,
            'creator_id': self.creator_id,
            'title': self.title,
            'amount': float(self.amount),
            'currency': self.currency,
            'date': self.date.isoformat() if self.date else None,
            'category': self.category,
            'receipt_url': self.receipt_url,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_participants:
            expense_dict['participants'] = [p.to_dict() for p in self.participants]
            
        return expense_dict


class ExpenseParticipant(db.Model):
    __tablename__ = 'expense_participants'
    
    id = db.Column(db.Integer, primary_key=True)
    expense_id = db.Column(db.String(36), db.ForeignKey('expenses.id'), nullable=False)
    user_id = db.Column(db.String(40), db.ForeignKey('users.id'), nullable=False)
    share_amount = db.Column(db.Numeric(10, 2), nullable=False)
    paid = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    expense = db.relationship('Expense', back_populates='participants')
    user = db.relationship('User')
    
    def to_dict(self):
        return {
            'id': self.id,
            'expense_id': self.expense_id,
            'user_id': self.user_id,
            'share_amount': float(self.share_amount),
            'paid': self.paid,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }