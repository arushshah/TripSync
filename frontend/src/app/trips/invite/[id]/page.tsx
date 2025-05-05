'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../lib/auth/AuthProvider';
import { Trip, RSVPStatus } from '../../../../types';

export default function TripInvite() {
  const params = useParams();
  const router = useRouter();
  const { user, loading, getIdToken } = useAuth();
  
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState<RSVPStatus | null>(null);
  const [alreadyResponded, setAlreadyResponded] = useState(false);
  const [previousResponse, setPreviousResponse] = useState<RSVPStatus | null>(null);
  
  const tripId = params.id as string;

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Save the trip ID to local storage so we can redirect back after login
        if (typeof window !== 'undefined' && tripId) {
          localStorage.setItem('pendingInvite', tripId);
        }
        router.push('/login');
      } else {
        fetchTripData();
      }
    }
  }, [loading, user, router, tripId]);

  const fetchTripData = async () => {
    if (!tripId || !user) return;

    try {
      setIsLoading(true);
      
      // Get Firebase token
      const token = await getIdToken();
      if (!token) {
        throw new Error('Authentication failed. Please log in again.');
      }
      
      // Fetch trip details from Flask API
      const tripResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/trips/${tripId}/invite-info`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!tripResponse.ok) {
        if (tripResponse.status === 404) {
          throw new Error('Trip not found');
        }
        throw new Error('Failed to load trip invitation');
      }

      const tripData = await tripResponse.json();
      setTrip(tripData.trip);
      
      // Check if user has already responded to the invitation
      if (tripData.user_response) {
        setAlreadyResponded(true);
        setPreviousResponse(tripData.user_response.rsvp_status);
      }
    } catch (err: any) {
      console.error('Error fetching trip data:', err);
      setError(err.message || 'Failed to load trip data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRSVP = async (status: RSVPStatus) => {
    if (!user || !trip) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      // Get Firebase token
      const token = await getIdToken();
      if (!token) {
        throw new Error('Authentication failed. Please log in again.');
      }

      // Send RSVP to Flask API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/rsvp/${tripId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: status
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to respond to invitation');
      }

      const responseData = await response.json();
      
      // If waitlisted, show a message before redirecting
      if (responseData.waitlisted) {
        alert('You have been added to the waitlist for this trip as the guest limit has been reached.');
      }

      // Redirect to trip page
      router.push(`/trips/${tripId}`);
    } catch (err: any) {
      console.error('Error responding to invitation:', err);
      setError(err.message || 'Failed to respond to invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-primary border-gray-200 border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-red-600 mb-2">Error</h2>
          <p className="mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-primary text-white py-2 px-4 rounded hover:bg-primary-dark"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">TripSync</h1>
          <p className="mt-2 text-gray-600">Trip Invitation</p>
        </div>
        
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold mb-2">{trip?.name}</h2>
          <p className="text-gray-600 mb-1">{trip?.location}</p>
          <p className="text-gray-600">
            {trip?.start_date && new Date(trip.start_date).toLocaleDateString()} - 
            {trip?.end_date && new Date(trip.end_date).toLocaleDateString()}
          </p>
          
          {trip?.description && (
            <div className="mt-4 text-left">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">About this trip</h3>
              <p className="text-gray-700 whitespace-pre-line">{trip.description}</p>
            </div>
          )}
        </div>
        
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-center mb-4">
            {alreadyResponded 
              ? `You've already responded as "${previousResponse}". Want to change your response?`
              : "Will you be joining this trip?"}
          </h3>
          
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => handleRSVP('going')}
              disabled={isSubmitting}
              className="bg-green-500 hover:bg-green-600 text-white py-4 px-4 rounded-md transition-colors disabled:opacity-50 flex flex-col items-center"
            >
              <span className="text-2xl mb-1">👍</span>
              <span className="font-medium">Going</span>
            </button>
            
            <button
              onClick={() => handleRSVP('maybe')}
              disabled={isSubmitting}
              className="bg-yellow-500 hover:bg-yellow-600 text-white py-4 px-4 rounded-md transition-colors disabled:opacity-50 flex flex-col items-center"
            >
              <span className="text-2xl mb-1">🤔</span>
              <span className="font-medium">Maybe</span>
            </button>
            
            <button
              onClick={() => handleRSVP('not_going')}
              disabled={isSubmitting}
              className="bg-red-500 hover:bg-red-600 text-white py-4 px-4 rounded-md transition-colors disabled:opacity-50 flex flex-col items-center"
            >
              <span className="text-2xl mb-1">👎</span>
              <span className="font-medium">Can't Go</span>
            </button>
          </div>
        </div>
        
        {trip?.guest_limit && trip.guest_limit > 0 && (
          <p className="text-sm text-gray-500 text-center">
            Note: This trip has a guest limit of {trip.guest_limit}. If the limit has been reached, 
            you will be added to the waitlist if you select "Going".
          </p>
        )}
      </div>
    </div>
  );
}