'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../lib/auth/AuthProvider';
import { api } from '../../../../lib/api';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { Textarea } from '../../../../components/ui/textarea';
import { Label } from '../../../../components/ui/label';
import { Header } from '../../../../components/Header';
import { ArrowLeft } from 'lucide-react';
import { Trip } from '../../../../types';
import { format } from 'date-fns';
import { listTripCoverImagePaths, getTripCoverSignedUrl } from '../../../../lib/supabase';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';

export default function EditTrip() {
  const { user, user_id, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    startDate: '',
    endDate: '',
    guestLimit: 0
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [coverPhotoPath, setCoverPhotoPath] = useState<string | null>(null);
  const [coverPhotoPreviewUrl, setCoverPhotoPreviewUrl] = useState<string | null>(null);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [availablePhotos, setAvailablePhotos] = useState<string[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else {
        fetchTripData();
      }
    }
  }, [loading, user, router, tripId]);

  useEffect(() => {
    // Preload available cover photo paths
    const fetchPhotos = async () => {
      setLoadingPhotos(true);
      const paths = await listTripCoverImagePaths();
      setAvailablePhotos(paths);
      setLoadingPhotos(false);
    };
    fetchPhotos();
  }, []);

  // When coverPhotoPath changes, generate a signed URL for preview
  useEffect(() => {
    if (!coverPhotoPath) {
      setCoverPhotoPreviewUrl(null);
      return;
    }
    let isMounted = true;
    getTripCoverSignedUrl(coverPhotoPath).then((url) => {
      if (isMounted) setCoverPhotoPreviewUrl(url);
    });
    return () => { isMounted = false; };
  }, [coverPhotoPath]);

  const fetchTripData = async () => {
    if (!user || !user_id || !tripId) return;

    try {
      setIsLoading(true);
      
      // Use API client to fetch trip data
      const tripData = await api.getTripById(tripId);
      
      // Check if user is a planner
      const currentMember = tripData.members?.find((member: any) => member.user_id === user_id);
      if (currentMember) {
        setUserRole(currentMember.role);
        
        // If not a planner, redirect back to trip page
        if (currentMember.role !== 'planner') {
          router.push(`/trips/${tripId}`);
          return;
        }
      } else {
        // User is not a member of this trip
        router.push('/dashboard');
        return;
      }
      
      // Format dates for the date input fields (YYYY-MM-DD)
      const formatDateForInput = (dateString: string) => {
        const date = new Date(dateString);
        return format(date, 'yyyy-MM-dd');
      };
      
      // Populate the form data with trip information
      setFormData({
        name: tripData.name || '',
        description: tripData.description || '',
        location: tripData.location || '',
        startDate: formatDateForInput(tripData.start_date),
        endDate: formatDateForInput(tripData.end_date),
        guestLimit: tripData.guest_limit || 0
      });
      setCoverPhotoPath(tripData.cover_photo_path || null);
      
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error fetching trip data:', err);
      setError(err.message || 'Failed to load trip data');
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGuestLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setFormData(prev => ({ ...prev, guestLimit: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!user) {
        throw new Error('You must be logged in to update a trip');
      }

      // Validate form data
      if (!formData.name.trim()) {
        throw new Error('Trip name is required');
      }
      
      if (!formData.location.trim()) {
        throw new Error('Location is required');
      }
      
      if (!formData.startDate) {
        throw new Error('Start date is required');
      }
      
      if (!formData.endDate) {
        throw new Error('End date is required');
      }
      
      if (new Date(formData.startDate) > new Date(formData.endDate)) {
        throw new Error('Start date cannot be after end date');
      }

      // Update trip using the API client
      await api.updateTrip(tripId, {
        name: formData.name,
        description: formData.description,
        location: formData.location,
        start_date: formData.startDate,
        end_date: formData.endDate,
        guest_limit: formData.guestLimit > 0 ? formData.guestLimit : null,
        cover_photo_path: coverPhotoPath || null
      });
      
      // Redirect back to the trip details page
      router.push(`/trips/${tripId}`);
      
    } catch (err: any) {
      setError(err.message || 'Failed to update trip');
      console.error('Error updating trip:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/trips/${tripId}`)}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Trip
          </Button>
        </div>

        <h1 className="text-2xl font-bold mb-8">Edit Trip</h1>
        
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-destructive/15 p-3 rounded-md text-destructive text-sm">
                  {error}
                </div>
              )}

              {/* Photo Picker UI */}
              <div className="space-y-2">
                <Label>Trip Cover Photo</Label>
                <div className="flex items-center gap-4">
                  {coverPhotoPreviewUrl ? (
                    <Image src={coverPhotoPreviewUrl} alt="Trip Cover" width={120} height={80} className="rounded-md object-cover border" />
                  ) : (
                    <div className="w-[120px] h-[80px] bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground border">No photo</div>
                  )}
                  <Button type="button" variant="outline" onClick={() => setShowPhotoDialog(true)}>
                    Choose Photo
                  </Button>
                </div>
              </div>
              {/* Photo Picker Dialog */}
              <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Choose a Trip Cover Photo</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto mt-2">
                    {loadingPhotos ? (
                      <div className="col-span-full text-center py-8">Loading photos...</div>
                    ) : availablePhotos.length === 0 ? (
                      <div className="col-span-full text-center py-8">No photos available</div>
                    ) : (
                      availablePhotos.map((path) => (
                        <PhotoOptionButton
                          key={path}
                          filePath={path}
                          selected={coverPhotoPath === path}
                          onSelect={() => {
                            setCoverPhotoPath(path);
                            setShowPhotoDialog(false);
                          }}
                        />
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <div className="space-y-2">
                <Label htmlFor="name">Trip Name *</Label>
                <Input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Summer Beach Getaway"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Tell your guests a bit about this trip"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="e.g. Miami, Florida"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    type="date"
                    id="startDate"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    type="date"
                    id="endDate"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="guestLimit">Guest Limit (optional)</Label>
                <Input
                  type="number"
                  id="guestLimit"
                  name="guestLimit"
                  value={formData.guestLimit || ''}
                  onChange={handleGuestLimitChange}
                  min="0"
                  placeholder="Leave at 0 for no limit"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Maximum number of guests who can RSVP as "going" (set to 0 for no limit)
                </p>
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/trips/${tripId}`)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// Helper component for photo option button
function PhotoOptionButton({ filePath, selected, onSelect }: { filePath: string; selected: boolean; onSelect: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    let isMounted = true;
    getTripCoverSignedUrl(filePath).then((url) => {
      if (isMounted) setPreviewUrl(url);
    });
    return () => { isMounted = false; };
  }, [filePath]);
  return (
    <button
      type="button"
      className={`border rounded-md overflow-hidden focus:ring-2 focus:ring-primary ${selected ? 'ring-2 ring-primary' : ''}`}
      onClick={onSelect}
      disabled={!previewUrl}
    >
      {previewUrl ? (
        <Image src={previewUrl} alt="Trip Cover Option" width={120} height={80} className="object-cover w-full h-[80px]" />
      ) : (
        <div className="w-[120px] h-[80px] flex items-center justify-center text-xs text-muted-foreground bg-muted">Loading...</div>
      )}
    </button>
  );
}