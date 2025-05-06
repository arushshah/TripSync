from db import db
from sqlalchemy.sql import func
import uuid

class Document(db.Model):
    __tablename__ = 'documents'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    trip_id = db.Column(db.String(36), db.ForeignKey('trips.id'), nullable=False)
    user_id = db.Column(db.String(40), db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    file_url = db.Column(db.String(500), nullable=False)
    file_type = db.Column(db.String(50), nullable=False)  # mime type
    file_size = db.Column(db.Integer, nullable=False)  # in bytes
    document_type = db.Column(db.String(20), nullable=False)  # travel, accommodation
    description = db.Column(db.Text, nullable=True)
    is_public = db.Column(db.Boolean, default=True, nullable=False)  # Whether the document is visible to all trip members
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    trip = db.relationship('Trip', back_populates='documents')
    user = db.relationship('User')
    
    def to_dict(self):
        return {
            'id': self.id,
            'trip_id': self.trip_id,
            'user_id': self.user_id,
            'name': self.name,
            'file_url': self.file_url,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'document_type': self.document_type,
            'description': self.description,
            'is_public': self.is_public,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }