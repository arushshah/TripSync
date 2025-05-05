from db import db
from sqlalchemy.sql import func
import uuid

class Trip(db.Model):
    __tablename__ = 'trips'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    location = db.Column(db.String(200), nullable=True)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    guest_limit = db.Column(db.Integer, nullable=True)
    creator_id = db.Column(db.String(40), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    members = db.relationship('TripMember', back_populates='trip', cascade='all, delete-orphan')
    documents = db.relationship('Document', back_populates='trip', cascade='all, delete-orphan')
    itinerary_items = db.relationship('ItineraryItem', back_populates='trip', cascade='all, delete-orphan')
    todos = db.relationship('TodoItem', back_populates='trip', cascade='all, delete-orphan')
    expenses = db.relationship('Expense', back_populates='trip', cascade='all, delete-orphan')
    polls = db.relationship('Poll', back_populates='trip', cascade='all, delete-orphan')
    map_markers = db.relationship('MapMarker', back_populates='trip', cascade='all, delete-orphan')
    
    def to_dict(self, include_members=False):
        trip_dict = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'location': self.location,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'guest_limit': self.guest_limit,
            'creator_id': self.creator_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_members:
            trip_dict['members'] = [member.to_dict() for member in self.members]
            
        return trip_dict


class TripMember(db.Model):
    __tablename__ = 'trip_members'
    
    id = db.Column(db.Integer, primary_key=True)
    trip_id = db.Column(db.String(36), db.ForeignKey('trips.id'), nullable=False)
    user_id = db.Column(db.String(40), db.ForeignKey('users.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='guest')  # planner, guest, viewer
    rsvp_status = db.Column(db.String(10), nullable=False, default='pending')  # going, maybe, no, pending
    waitlist_position = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    trip = db.relationship('Trip', back_populates='members')
    user = db.relationship('User', back_populates='trips')
    
    def to_dict(self, include_user=True):
        member_dict = {
            'id': self.id,
            'trip_id': self.trip_id,
            'user_id': self.user_id,
            'role': self.role,
            'rsvp_status': self.rsvp_status,
            'waitlist_position': self.waitlist_position,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_user:
            member_dict['user'] = self.user.to_dict()
            
        return member_dict