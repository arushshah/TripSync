from db import db
from sqlalchemy.sql import func
import uuid

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(40), primary_key=True, default=lambda: str(uuid.uuid4()))
    firebase_uid = db.Column(db.String(40), unique=True, nullable=False)
    phone_number = db.Column(db.String(15), unique=True, nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    profile_photo = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    trips = db.relationship('TripMember', back_populates='user', lazy='dynamic')
    expenses = db.relationship('Expense', back_populates='creator', lazy='dynamic')
    todos = db.relationship('TodoItem', back_populates='assigned_to', lazy='dynamic', 
                          foreign_keys='TodoItem.assigned_to_id')
    created_todos = db.relationship('TodoItem', foreign_keys='TodoItem.creator_id', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'firebase_uid': self.firebase_uid,
            'phone_number': self.phone_number,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'profile_photo': self.profile_photo,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }