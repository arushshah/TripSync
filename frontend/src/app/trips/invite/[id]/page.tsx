'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../lib/auth/AuthProvider';
import { api } from '../../../../lib/api';

export default function TripInvite() {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const tripId = params.id as string;

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Save the trip ID and redirect intention to local storage
        if (typeof window !== 'undefined' && tripId) {
          localStorage.setItem('pendingInvite', tripId);
          localStorage.setItem('redirectToDashboard', 'true');
        }
        router.push('/login');
      } else {
        handleInvite();
      }
    }
  }, [loading, user, router, tripId]);

  const handleInvite = async () => {
    if (!tripId || !user) return;

    try {
      // Process the invitation - this will add the user to the trip with pending status
      await api.getTripInviteInfo(tripId);
      
      // Redirect to the dashboard with invitations tab active
      router.push('/dashboard?tab=invitations');
    } catch (err: any) {
      console.error('Error processing invitation:', err);
      // Still redirect to dashboard on error - the user might already be invited
      router.push('/dashboard?tab=invitations');
    }
  };

  // Simple loading state
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-t-primary border-gray-200 border-solid rounded-full animate-spin mx-auto"></div>
        <p className="mt-4 text-gray-600">Processing invitation...</p>
      </div>
    </div>
  );
}