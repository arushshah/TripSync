from db import db
from sqlalchemy.sql import func
import uuid

class Poll(db.Model):
    __tablename__ = 'polls'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    trip_id = db.Column(db.String(36), db.ForeignKey('trips.id'), nullable=False)
    creator_id = db.Column(db.String(40), db.ForeignKey('users.id'), nullable=False)
    question = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    end_date = db.Column(db.DateTime(timezone=True), nullable=True)
    allow_multiple = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    trip = db.relationship('Trip', back_populates='polls')
    creator = db.relationship('User')
    options = db.relationship('PollOption', back_populates='poll', cascade='all, delete-orphan')
    
    def to_dict(self, include_options=False, include_votes=False):
        poll_dict = {
            'id': self.id,
            'trip_id': self.trip_id,
            'creator_id': self.creator_id,
            'question': self.question,
            'description': self.description,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'allow_multiple': self.allow_multiple,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_options:
            poll_dict['options'] = [option.to_dict(include_votes) for option in self.options]
            
        return poll_dict


class PollOption(db.Model):
    __tablename__ = 'poll_options'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    poll_id = db.Column(db.String(36), db.ForeignKey('polls.id'), nullable=False)
    text = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    poll = db.relationship('Poll', back_populates='options')
    votes = db.relationship('PollVote', back_populates='option', cascade='all, delete-orphan')
    
    def to_dict(self, include_votes=False):
        option_dict = {
            'id': self.id,
            'poll_id': self.poll_id,
            'text': self.text,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'vote_count': len(self.votes),
        }
        
        if include_votes:
            option_dict['votes'] = [vote.to_dict() for vote in self.votes]
            
        return option_dict


class PollVote(db.Model):
    __tablename__ = 'poll_votes'
    
    id = db.Column(db.Integer, primary_key=True)
    option_id = db.Column(db.String(36), db.ForeignKey('poll_options.id'), nullable=False)
    user_id = db.Column(db.String(40), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    option = db.relationship('PollOption', back_populates='votes')
    user = db.relationship('User')
    
    def to_dict(self):
        return {
            'id': self.id,
            'option_id': self.option_id,
            'user_id': self.user_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    __table_args__ = (
        db.UniqueConstraint('option_id', 'user_id', name='unique_user_vote_per_option'),
    )