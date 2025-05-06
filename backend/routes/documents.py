from flask import Blueprint, request, jsonify
from db import db
from models.document import Document
from middleware.auth import authenticate_token, is_trip_member
import uuid
import os

documents_bp = Blueprint('documents', __name__)

@documents_bp.route('/<trip_id>', methods=['GET'])
@authenticate_token
@is_trip_member()
def get_documents(trip_id):
    """Get all documents for a trip"""
    document_type = request.args.get('type')
    
    # Base query
    query = Document.query.filter_by(trip_id=trip_id)
    
    # Filter by document type if provided
    if document_type in ['travel', 'accommodation']:
        query = query.filter_by(document_type=document_type)
        
    # Only show documents that are either public or owned by the requesting user
    query = query.filter((Document.is_public == True) | (Document.user_id == request.user_id))
    
    documents = query.order_by(Document.created_at.desc()).all()
    
    return jsonify([doc.to_dict() for doc in documents]), 200

@documents_bp.route('/<trip_id>', methods=['POST'])
@authenticate_token
@is_trip_member()
def upload_document(trip_id):
    """Upload a new document for a trip"""
    # In a production app, the file would be uploaded to Supabase Storage
    # For this example, we'll just create a document record with dummy file details
    
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
        
    required_fields = ['name', 'file_url', 'file_type', 'file_size', 'document_type']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
            
    if data['document_type'] not in ['travel', 'accommodation']:
        return jsonify({'error': 'Invalid document type. Must be travel or accommodation'}), 400
        
    document = Document(
        id=str(uuid.uuid4()),
        trip_id=trip_id,
        user_id=request.user_id,
        name=data['name'],
        file_url=data['file_url'],
        file_type=data['file_type'],
        file_size=data['file_size'],
        document_type=data['document_type'],
        description=data.get('description'),
        is_public=data.get('is_public', True)  # Default to public if not specified
    )
    
    db.session.add(document)
    db.session.commit()
    
    return jsonify(document.to_dict()), 201

@documents_bp.route('/<trip_id>/<document_id>', methods=['GET'])
@authenticate_token
@is_trip_member()
def get_document(trip_id, document_id):
    """Get a specific document"""
    document = Document.query.filter_by(id=document_id, trip_id=trip_id).first()
    
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    # Check if user has permission to view this document
    if not document.is_public and document.user_id != request.user_id:
        # Check if user is a trip planner (they can see all documents)
        trip_member = request.trip_member
        if trip_member.role != 'planner':
            return jsonify({'error': 'You do not have permission to view this document'}), 403
        
    return jsonify(document.to_dict()), 200

@documents_bp.route('/<trip_id>/<document_id>', methods=['PUT'])
@authenticate_token
@is_trip_member()
def update_document(trip_id, document_id):
    """Update a document"""
    document = Document.query.filter_by(id=document_id, trip_id=trip_id).first()
    
    if not document:
        return jsonify({'error': 'Document not found'}), 404
        
    # Only allow the document creator or a trip planner to update
    trip_member = request.trip_member  # Set by is_trip_member middleware
    if document.user_id != request.user_id and trip_member.role != 'planner':
        return jsonify({'error': 'You do not have permission to update this document'}), 403
        
    data = request.json
    
    if 'name' in data:
        document.name = data['name']
        
    if 'description' in data:
        document.description = data['description']
        
    if 'document_type' in data:
        if data['document_type'] not in ['travel', 'accommodation']:
            return jsonify({'error': 'Invalid document type. Must be travel or accommodation'}), 400
        document.document_type = data['document_type']
    
    if 'is_public' in data:
        document.is_public = data['is_public']
        
    db.session.commit()
    
    return jsonify(document.to_dict()), 200

@documents_bp.route('/<trip_id>/<document_id>', methods=['DELETE'])
@authenticate_token
@is_trip_member()
def delete_document(trip_id, document_id):
    """Delete a document"""
    document = Document.query.filter_by(id=document_id, trip_id=trip_id).first()
    
    if not document:
        return jsonify({'error': 'Document not found'}), 404
        
    # Only allow the document creator or a trip planner to delete
    trip_member = request.trip_member  # Set by is_trip_member middleware
    if document.user_id != request.user_id and trip_member.role != 'planner':
        return jsonify({'error': 'You do not have permission to delete this document'}), 403
    
    # Store file URL for response
    file_url = document.file_url
    
    # Delete the document record from the database
    db.session.delete(document)
    db.session.commit()
    
    # Return success response with file_url to help client clean up storage if needed
    return jsonify({
        'message': 'Document deleted successfully',
        'file_url': file_url
    }), 200