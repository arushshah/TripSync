'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';
import { Trip } from '../../types';
import { api } from '../../lib/api';
import { Header } from '../../components/Header';
import { Button } from '../../components/ui/button';
import { Calendar, MapPin, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (user) {
      fetchTrips();
    }
  }, [user, loading, router]);

  const fetchTrips = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      // Use the API client to fetch trips
      const tripsData = await api.getTrips();
      setTrips(tripsData || []);
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTrip = () => {
    router.push('/trips/new');
  };

  const handleTripClick = (tripId: string) => {
    router.push(`/trips/${tripId}`);
  };

  if (loading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="flex flex-col items-center">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="mt-4 text-muted-foreground">Loading your trips...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Your Trips</h1>
          <Button onClick={handleCreateTrip} className="gap-1" variant="teal">
            <Plus className="h-4 w-4" /> 
            Create Trip
          </Button>
        </div>

        <div className="mt-8">
          {trips.length === 0 ? (
            <Card className="border-dashed">
              <CardHeader className="text-center">
                <CardTitle>No trips yet</CardTitle>
                <CardDescription>Start planning your first trip with TripSync</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center pb-8 pt-4">
                <Button onClick={handleCreateTrip} className="gap-1" variant="teal">
                  <Plus className="h-4 w-4" />
                  Create Your First Trip
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip) => (
                <Card 
                  key={trip.id} 
                  className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
                  onClick={() => handleTripClick(trip.id)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="line-clamp-1">{trip.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {trip.location}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {trip.description || 'No description provided'}
                    </p>
                  </CardContent>
                  <CardFooter className="border-t pt-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {trip.start_date && trip.end_date ? (
                        <span>
                          {format(new Date(trip.start_date), 'MMM d')} - {format(new Date(trip.end_date), 'MMM d, yyyy')}
                        </span>
                      ) : (
                        <span>Dates not set</span>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}