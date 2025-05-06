'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';
import { Trip } from '../../types';
import { api } from '../../lib/api';
import { Header } from '../../components/Header';
import { Button } from '../../components/ui/button';
import { Calendar, MapPin, Plus, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

// Component that uses useSearchParams must be wrapped in Suspense
function DashboardContent() {
  const { user, loading } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [invitations, setInvitations] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('trips');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (user) {
      fetchTripsAndInvitations();
      
      // Check URL parameters for active tab
      const tabParam = searchParams.get('tab');
      if (tabParam === 'invitations') {
        setActiveTab('invitations');
      }
    }
  }, [user, loading, router, searchParams]);

  const fetchTripsAndInvitations = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      // Use the API client to fetch trips and invitations
      const [tripsData, invitationsData] = await Promise.all([
        api.getTrips(),
        api.getInvitations()
      ]);
      
      setTrips(tripsData || []);
      setInvitations(invitationsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
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

  const renderTripCards = (items: Trip[]) => {
    if (items.length === 0) {
      return (
        <Card className="border-dashed">
          <CardHeader className="text-center">
            <CardTitle>No trips</CardTitle>
            <CardDescription>No trips found in this category</CardDescription>
          </CardHeader>
        </Card>
      );
    }
    
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((trip) => (
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
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Your Trips</h1>
          <Button onClick={handleCreateTrip} className="gap-1" variant="teal">
            <Plus className="h-4 w-4" /> 
            Create Trip
          </Button>
        </div>

        <Tabs defaultValue={activeTab} className="space-y-6">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="trips">Your Trips</TabsTrigger>
            <TabsTrigger value="invitations" className="relative">
              Invitations
              {invitations.length > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-5 w-5 text-xs font-bold text-white bg-[hsl(var(--teal))] rounded-full">
                  {invitations.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="trips" className="space-y-6">
            {trips.length === 0 ? (
              <Card className="border-dashed">
                <CardHeader className="text-center">
                  <CardTitle>No trips yet</CardTitle>
                  <CardDescription>You haven't RSVP'd as 'Going' to any trips yet</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-8 pt-4">
                  <Button onClick={handleCreateTrip} className="gap-1" variant="teal">
                    <Plus className="h-4 w-4" />
                    Create Your First Trip
                  </Button>
                </CardContent>
              </Card>
            ) : renderTripCards(trips)}
          </TabsContent>
          
          <TabsContent value="invitations" className="space-y-6">
            {invitations.length > 0 ? (
              <>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <p>You have {invitations.length} invitation{invitations.length !== 1 ? 's' : ''} that need your attention. Click on a trip to view details and respond.</p>
                </div>
                {renderTripCards(invitations)}
              </>
            ) : (
              <Card className="border-dashed">
                <CardHeader className="text-center">
                  <CardTitle>No invitations</CardTitle>
                  <CardDescription>You don't have any pending invitations or trips you've responded to with "Maybe" or "Can't Go"</CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// Main component with Suspense boundary
export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="flex flex-col items-center">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}