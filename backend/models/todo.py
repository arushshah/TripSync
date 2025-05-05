from db import db
from sqlalchemy.sql import func
import uuid

class TodoItem(db.Model):
    __tablename__ = 'todo_items'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    trip_id = db.Column(db.String(36), db.ForeignKey('trips.id'), nullable=False)
    creator_id = db.Column(db.String(40), db.ForeignKey('users.id'), nullable=False)
    assigned_to_id = db.Column(db.String(40), db.ForeignKey('users.id'), nullable=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    due_date = db.Column(db.Date, nullable=True)
    completed = db.Column(db.Boolean, default=False, nullable=False)
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    trip = db.relationship('Trip', back_populates='todos')
    creator = db.relationship('User', foreign_keys=[creator_id], back_populates='created_todos')
    assigned_to = db.relationship('User', foreign_keys=[assigned_to_id], back_populates='todos')
    
    def to_dict(self):
        return {
            'id': self.id,
            'trip_id': self.trip_id,
            'creator_id': self.creator_id,
            'assigned_to_id': self.assigned_to_id,
            'title': self.title,
            'description': self.description,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'completed': self.completed,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }