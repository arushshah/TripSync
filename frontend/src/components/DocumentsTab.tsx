'use client';

import React, { useState, useEffect } from 'react';
import { Document as TripDocument, UserRole } from '../types';
import { api } from '../lib/api';
import { uploadFile, deleteFile, getTemporaryFileUrl } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { FileIcon, Building, Plus, Upload, Lock, Globe, MoreHorizontal, Eye, Download, Trash2, X, Loader2, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { format } from 'date-fns';
import { formatFileSize } from '../lib/utils';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle } from 'lucide-react';

type DocumentsTabProps = {
  tripId: string;
  currentUserId: string;
  userRole: UserRole | null;
  documentType: 'travel' | 'accommodation';
  title: string;
  description: string;
  icon: React.ReactNode;
};

// Document Preview Dialog Component
const DocumentPreview = ({ 
  isOpen, 
  onClose, 
  document, 
  tempUrl
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  document: TripDocument | null,
  tempUrl: string | null
}) => {
  if (!document) return null;
  
  const isImage = document.file_type.startsWith('image/');
  const isPDF = document.file_type === 'application/pdf';
  const isText = document.file_type.startsWith('text/');
  
  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-xl font-medium">{document.name}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 overflow-auto mt-2 rounded-md border">
          {!tempUrl ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading document...</span>
            </div>
          ) : isImage ? (
            <div className="flex items-center justify-center h-full bg-muted/30 p-4">
              <img 
                src={tempUrl} 
                alt={document.name} 
                className="max-h-full max-w-full object-contain" 
              />
            </div>
          ) : isPDF ? (
            <iframe 
              src={tempUrl} 
              title={document.name}
              className="w-full h-full border-0" 
            />
          ) : isText ? (
            <iframe
              src={tempUrl}
              title={document.name}
              className="w-full h-full border-0"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <FileIcon className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Preview not available</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This file type ({document.file_type}) cannot be previewed in the browser.
              </p>
              <Button onClick={() => window.open(tempUrl, '_blank')} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Open in new tab
              </Button>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {formatFileSize(document.file_size)} • {document.file_type}
          </div>
          <Button onClick={() => window.open(tempUrl, '_blank')} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export function DocumentsTab({ 
  tripId, 
  currentUserId, 
  userRole, 
  documentType,
  title,
  description,
  icon
}: DocumentsTabProps) {
  const [documents, setDocuments] = useState<TripDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Form fields
  const [documentName, setDocumentName] = useState('');
  const [documentDescription, setDocumentDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // State for temporary URLs
  const [tempUrls, setTempUrls] = useState<{ [key: string]: string }>({});
  const [generatingUrl, setGeneratingUrl] = useState<{ [key: string]: boolean }>({});

  // Document preview state
  const [previewDocument, setPreviewDocument] = useState<TripDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  // Load documents when component mounts
  useEffect(() => {
    loadDocuments();
  }, [tripId, documentType]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const docs = await api.getDocuments(tripId, documentType);
      setDocuments(docs as unknown as TripDocument[]);
    } catch (err: any) {
      console.error(`Failed to load ${documentType} documents:`, err);
      setError('Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      // Auto-populate name if not set
      if (!documentName) {
        setDocumentName(file.name.split('.')[0]);
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setUploadError('Please select a file to upload');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      
      // Track upload progress
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 95) {
            clearInterval(interval);
            return prev;
          }
          return prev + 5;
        });
      }, 100);

      // 1. Upload file to Supabase storage
      const fileUrl = await uploadFile(selectedFile, tripId, currentUserId);
      
      // 2. Send document metadata to API
      const documentData = {
        name: documentName,
        description: documentDescription,
        file_url: fileUrl,
        file_type: selectedFile.type,
        file_size: selectedFile.size,
        document_type: documentType,
        is_public: isPublic
      };
      
      const newDocument = await api.uploadDocument(tripId, documentData);
      
      // 3. Clear form and update UI
      setDocuments(prevDocs => [(newDocument as unknown) as TripDocument, ...prevDocs]);
      setShowUploadDialog(false);
      resetUploadForm();
      
      clearInterval(interval);
      setUploadProgress(100);
      
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err.message || 'Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const resetUploadForm = () => {
    setSelectedFile(null);
    setDocumentName('');
    setDocumentDescription('');
    setIsPublic(true);
    setUploadProgress(0);
  };

  const handleDeleteDocument = async (documentId: string, fileUrl: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      // 1. Delete document record from the API
      await api.deleteDocument(tripId, documentId);
      
      // 2. Delete file from Supabase storage
      await deleteFile(fileUrl);
      
      // 3. Update UI
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    } catch (err: any) {
      console.error('Failed to delete document:', err);
      alert('Failed to delete document. Please try again.');
    }
  };

  const handleToggleVisibility = async (document: TripDocument) => {
    try {
      const updatedDocument = await api.updateDocument(tripId, document.id, {
        is_public: !document.is_public
      });
      
      // Update document in state
      setDocuments(prev => prev.map(doc => 
        doc.id === document.id ? (updatedDocument as unknown as TripDocument) : doc
      ));
    } catch (err: any) {
      console.error('Failed to update document visibility:', err);
      alert('Failed to update document visibility. Please try again.');
    }
  };

  const canManageDocument = (document: TripDocument) => {
    return currentUserId === document.user_id || userRole === 'planner';
  };

  const getFileIcon = (fileType: string) => {
    // Return appropriate icon based on file type
    if (fileType.includes('image/')) {
      return '📷';
    } else if (fileType.includes('application/pdf')) {
      return '📄';
    } else if (fileType.includes('text/')) {
      return '📝';
    } else {
      return '📁';
    }
  };

  // Add a function to get or fetch a thumbnail URL for images
  const getThumbnailUrl = async (document: TripDocument) => {
    if (!document.file_type.startsWith('image/')) return undefined;
    if (tempUrls[document.id]) return tempUrls[document.id];
    setGeneratingUrl(prev => ({ ...prev, [document.id]: true }));
    try {
      const url = await getTemporaryFileUrl(document.file_url);
      setTempUrls(prev => ({ ...prev, [document.id]: url }));
      return url;
    } finally {
      setGeneratingUrl(prev => ({ ...prev, [document.id]: false }));
    }
  };

  // Handle document preview in popup
  const handlePreviewDocument = async (document: TripDocument) => {
    try {
      setPreviewDocument(document);
      setPreviewUrl(null);
      setIsPreviewOpen(true);
      setGeneratingUrl(prev => ({ ...prev, [document.id]: true }));
      
      // Generate a temporary signed URL
      const tempUrl = await getTemporaryFileUrl(document.file_url);
      
      // Store the URL in our state
      setTempUrls(prev => ({ ...prev, [document.id]: tempUrl }));
      setPreviewUrl(tempUrl);
    } catch (err) {
      console.error('Failed to generate temporary URL for preview:', err);
      alert('Unable to generate a preview. Please try again.');
      setIsPreviewOpen(false);
    } finally {
      setGeneratingUrl(prev => ({ ...prev, [document.id]: false }));
    }
  };
  
  const closePreview = () => {
    setIsPreviewOpen(false);
    setPreviewDocument(null);
    setPreviewUrl(null);
  };

  // Handle document download with temporary URLs
  const handleDownloadDocument = async (doc: TripDocument) => {
    try {
      setGeneratingUrl(prev => ({ ...prev, [doc.id]: true }));
      
      // Generate a temporary signed URL
      const tempUrl = await getTemporaryFileUrl(doc.file_url);
      
      // Create an anchor element and trigger download
      const link = document.createElement('a');
      link.href = tempUrl;
      link.download = doc.name || 'download'; // Use document name or fallback
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download file:', err);
      alert('Unable to download the file. Please try again.');
    } finally {
      setGeneratingUrl(prev => ({ ...prev, [doc.id]: false }));
    }
  };

  useEffect(() => {
    // Preload thumbnails for images
    documents.forEach(doc => {
      if (doc.file_type.startsWith('image/') && !tempUrls[doc.id]) {
        getThumbnailUrl(doc);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon} {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <div className="flex flex-col items-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <p className="mt-2 text-sm text-muted-foreground">Loading documents...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            {icon} {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Upload className="h-4 w-4" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload {title}</DialogTitle>
              <DialogDescription>
                {`Share ${documentType} documents with your trip members`}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleUpload} className="space-y-4">
              {uploadError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{uploadError}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="file">Document</Label>
                <Input 
                  id="file" 
                  type="file" 
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                {selectedFile && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Document Name</Label>
                <Input
                  id="name"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="Enter document name"
                  disabled={uploading}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={documentDescription}
                  onChange={(e) => setDocumentDescription(e.target.value)}
                  placeholder="Enter document description"
                  disabled={uploading}
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="public">Make Document Public</Label>
                  <p className="text-xs text-muted-foreground">
                    {isPublic 
                      ? "All trip members can view this document" 
                      : "Only you can view this document"}
                  </p>
                </div>
                <Switch
                  id="public"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                  disabled={uploading}
                />
              </div>
              
              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowUploadDialog(false)}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={!selectedFile || !documentName || uploading}
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <FileIcon className="mb-2 h-8 w-8 text-muted-foreground" />
            <h3 className="font-medium">No documents yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload {documentType} documents to share with your group
            </p>
            <Button 
              onClick={() => setShowUploadDialog(true)} 
              variant="outline" 
              className="mt-4"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Document
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map(document => (
              <div 
                key={document.id} 
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-lg overflow-hidden">
                    {document.file_type.startsWith('image/') && tempUrls[document.id] ? (
                      <img
                        src={tempUrls[document.id]}
                        alt={document.name}
                        className="object-cover w-10 h-10"
                      />
                    ) : (
                      getFileIcon(document.file_type)
                    )}
                  </div>
                  <div>
                    <div className="font-medium flex items-center">
                      {document.name}
                      {!document.is_public && <Lock className="ml-2 h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <span>{format(new Date(document.created_at), 'MMM d, yyyy')}</span>
                      <span className="text-muted-foreground">•</span>
                      <span>{formatFileSize(document.file_size)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handlePreviewDocument(document)}
                    disabled={generatingUrl[document.id]}
                  >
                    {generatingUrl[document.id] ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  
                  {canManageDocument(document) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => handleToggleVisibility(document)}
                          className="flex gap-2 items-center"
                        >
                          {document.is_public ? (
                            <>
                              <Lock className="h-4 w-4" />
                              <span>Make Private</span>
                            </>
                          ) : (
                            <>
                              <Globe className="h-4 w-4" />
                              <span>Make Public</span>
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDownloadDocument(document)}
                          className="flex gap-2 items-center"
                          disabled={generatingUrl[document.id]}
                        >
                          <Download className="h-4 w-4" />
                          <span>Download</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteDocument(document.id, document.file_url)}
                          className="text-destructive flex gap-2 items-center"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Document Preview Modal */}
        <DocumentPreview 
          isOpen={isPreviewOpen} 
          onClose={closePreview} 
          document={previewDocument}
          tempUrl={previewUrl}
        />
      </CardContent>
    </Card>
  );
}