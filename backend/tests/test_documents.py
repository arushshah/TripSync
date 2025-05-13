import json
import pytest
import io
from werkzeug.datastructures import FileStorage

def test_get_trip_documents(client, auth_headers, init_database, app):
    """Test retrieving a trip's documents."""
    trip_id = app.test_data['trip_id']
    
    response = client.get(f'/api/trips/{trip_id}/documents', headers=auth_headers)
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert len(data) > 0
    assert data[0]['title'] == 'Test Document'
    assert data[0]['type'] == 'pdf'
    assert data[0]['uploader_id'] == 'test_user_id'

def test_create_document(client, auth_headers, init_database, app, monkeypatch):
    """Test creating a document."""
    trip_id = app.test_data['trip_id']
    
    # Mock file upload handling
    def mock_save_document(*args, **kwargs):
        return "https://storage.example.com/documents/test-document.pdf"
    
    # Apply the monkeypatch for file saving function
    # This assumes you have a function like save_document in your routes or utils
    monkeypatch.setattr("routes.documents.save_document", mock_save_document)
    
    # Create test file
    test_file = FileStorage(
        stream=io.BytesIO(b"test file content"),
        filename="test-document.pdf",
        content_type="application/pdf"
    )
    
    # Create document with file
    response = client.post(
        f'/api/trips/{trip_id}/documents',
        data={
            'title': 'New Document',
            'description': 'A new test document',
            'type': 'pdf',
            'file': test_file
        },
        headers=auth_headers,
        content_type='multipart/form-data'
    )
    
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['title'] == 'New Document'
    assert data['description'] == 'A new test document'
    assert data['type'] == 'pdf'
    assert data['file_url'].startswith('https://storage.example.com/')
    assert data['trip_id'] == trip_id
    assert data['uploader_id'] == 'test_user_id'  # From auth headers

def test_update_document(client, auth_headers, init_database, app):
    """Test updating a document's metadata."""
    trip_id = app.test_data['trip_id']
    
    # First, get an existing document
    get_response = client.get(
        f'/api/trips/{trip_id}/documents',
        headers=auth_headers
    )
    documents = json.loads(get_response.data)
    document_id = documents[0]['id']
    
    update_data = {
        'title': 'Updated Document',
        'description': 'This document has been updated',
    }
    
    response = client.put(
        f'/api/trips/{trip_id}/documents/{document_id}',
        data=json.dumps(update_data),
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['title'] == update_data['title']
    assert data['description'] == update_data['description']
    # Type and file_url should remain unchanged
    assert data['type'] == documents[0]['type']
    assert data['file_url'] == documents[0]['file_url']

def test_delete_document(client, auth_headers, init_database, app, monkeypatch):
    """Test deleting a document."""
    trip_id = app.test_data['trip_id']
    
    # Mock file upload and deletion handling
    def mock_save_document(*args, **kwargs):
        return "https://storage.example.com/documents/temp-document.pdf"
    
    def mock_delete_document(*args, **kwargs):
        return True
    
    # Apply the monkeypatches
    monkeypatch.setattr("routes.documents.save_document", mock_save_document)
    monkeypatch.setattr("routes.documents.delete_document", mock_delete_document)
    
    # Create a document to delete
    test_file = FileStorage(
        stream=io.BytesIO(b"temp content"),
        filename="temp-document.pdf",
        content_type="application/pdf"
    )
    
    create_response = client.post(
        f'/api/trips/{trip_id}/documents',
        data={
            'title': 'Document to Delete',
            'type': 'pdf',
            'file': test_file
        },
        headers=auth_headers,
        content_type='multipart/form-data'
    )
    
    document_id = json.loads(create_response.data)['id']
    
    # Delete the document
    delete_response = client.delete(
        f'/api/trips/{trip_id}/documents/{document_id}',
        headers=auth_headers
    )
    
    assert delete_response.status_code == 204
    
    # Verify the document was deleted
    get_response = client.get(
        f'/api/trips/{trip_id}/documents',
        headers=auth_headers
    )
    documents = json.loads(get_response.data)
    assert not any(document['id'] == document_id for document in documents)

def test_download_document(client, auth_headers, init_database, app, monkeypatch):
    """Test downloading a document."""
    trip_id = app.test_data['trip_id']
    
    # First, get an existing document
    get_response = client.get(
        f'/api/trips/{trip_id}/documents',
        headers=auth_headers
    )
    documents = json.loads(get_response.data)
    document_id = documents[0]['id']
    
    # Mock download function to return a test file
    def mock_get_document_file(*args, **kwargs):
        return io.BytesIO(b"test file content")
    
    monkeypatch.setattr("routes.documents.get_document_file", mock_get_document_file)
    
    response = client.get(
        f'/api/trips/{trip_id}/documents/{document_id}/download',
        headers=auth_headers
    )
    
    assert response.status_code == 200
    assert response.data == b"test file content"
    assert response.headers['Content-Disposition'].startswith('attachment; filename=')
    assert response.headers['Content-Type'] == 'application/octet-stream'

def test_document_access_control(client, auth_headers, init_database, app):
    """Test document access control."""
    trip_id = app.test_data['trip_id']
    
    # Create a document
    # Mock file upload handling (inline for this test)
    def mock_save_document(*args, **kwargs):
        return "https://storage.example.com/documents/secure-document.pdf"
    
    # Get existing document
    get_response = client.get(
        f'/api/trips/{trip_id}/documents',
        headers=auth_headers
    )
    documents = json.loads(get_response.data)
    document_id = documents[0]['id']
    
    # Create headers for a user who's not part of the trip
    unauthorized_headers = {
        'Authorization': 'Bearer test_token',
        'Content-Type': 'application/json',
        'Firebase-UID': 'unauthorized_user_id'
    }
    
    # Try to access the document with an unauthorized user
    response = client.get(
        f'/api/trips/{trip_id}/documents/{document_id}',
        headers=unauthorized_headers
    )
    
    # Should get a 403 Forbidden or 401 Unauthorized
    assert response.status_code in (401, 403)
    
def test_document_validation(client, auth_headers, init_database, app):
    """Test validation of document data."""
    trip_id = app.test_data['trip_id']
    
    # Test with missing required fields (no title)
    test_file = FileStorage(
        stream=io.BytesIO(b"invalid document"),
        filename="invalid-document.pdf",
        content_type="application/pdf"
    )
    
    response = client.post(
        f'/api/trips/{trip_id}/documents',
        data={
            # Missing title
            'type': 'pdf',
            'file': test_file
        },
        headers=auth_headers,
        content_type='multipart/form-data'
    )
    
    assert response.status_code == 400
    
    # Test with unsupported file type
    test_file = FileStorage(
        stream=io.BytesIO(b"invalid file type"),
        filename="invalid-file.xyz",
        content_type="application/octet-stream"
    )
    
    response = client.post(
        f'/api/trips/{trip_id}/documents',
        data={
            'title': 'Invalid Document',
            'type': 'xyz',  # Unsupported type
            'file': test_file
        },
        headers=auth_headers,
        content_type='multipart/form-data'
    )
    
    assert response.status_code == 400