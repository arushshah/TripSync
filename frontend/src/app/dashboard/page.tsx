'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';
import { Trip } from '../../types';
import { api } from '../../lib/api';
import { Header } from '../../components/Header';
import { Button } from '../../components/ui/button';
import { Calendar, MapPin, Plus, Mail, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

// Component for Your Trips tab
function YourTripsTab({ trips, onCreateTrip, onTripClick }: { 
  trips: Trip[], 
  onCreateTrip: () => void,
  onTripClick: (tripId: string) => void 
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">Your Trips</h2>
        <Button onClick={onCreateTrip} className="gap-1">
          <Plus className="h-4 w-4" /> 
          Create Trip
        </Button>
      </div>

      {trips.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="text-center">
            <CardTitle>No trips yet</CardTitle>
            <CardDescription>You haven't RSVP'd as 'Going' to any trips yet</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8 pt-4">
            <Button onClick={onCreateTrip} className="gap-1">
              <Plus className="h-4 w-4" />
              Create Your First Trip
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">
              Showing {trips.length} trip{trips.length !== 1 ? 's' : ''}
            </p>
            <Button variant="link" className="text-sm p-0 h-auto">
              View all <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          
          <div className="overflow-x-auto pb-4">
            <div className="flex space-x-4" style={{ minWidth: 'max-content' }}>
              {trips.map((trip) => (
                <Card 
                  key={trip.id} 
                  className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md flex-shrink-0"
                  onClick={() => onTripClick(trip.id)}
                  style={{ width: '300px' }}
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
          </div>
        </>
      )}
    </div>
  );
}

// Component for Invitations tab
function InvitationsTab({ invitations, onTripClick }: { 
  invitations: Trip[], 
  onTripClick: (tripId: string) => void 
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          Invitations
          {invitations.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center h-6 w-6 text-xs font-bold text-white bg-[hsl(var(--teal))] rounded-full">
              {invitations.length}
            </span>
          )}
        </h2>
      </div>

      {invitations.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="text-center">
            <CardTitle>No invitations</CardTitle>
            <CardDescription>You don't have any pending invitations or trips you've responded to with "Maybe" or "Can't Go"</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <Mail className="h-4 w-4" />
            <p>You have {invitations.length} invitation{invitations.length !== 1 ? 's' : ''} that need your attention. Click on a trip to view details and respond.</p>
          </div>
          
          <div className="overflow-x-auto pb-4">
            <div className="flex space-x-4" style={{ minWidth: 'max-content' }}>
              {invitations.map((trip) => (
                <Card 
                  key={trip.id} 
                  className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md flex-shrink-0"
                  onClick={() => onTripClick(trip.id)}
                  style={{ width: '300px' }}
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
          </div>
        </>
      )}
    </div>
  );
}

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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Manage your trips and invitations</p>
        </div>

        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="w-full sm:w-auto border-0 bg-transparent p-0 mb-2">
            <TabsTrigger 
              value="trips" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none
                         data-[state=active]:border-primary data-[state=active]:border-b-2
                         rounded-none px-5 py-2 font-medium">
              Your Trips
            </TabsTrigger>
            <TabsTrigger 
              value="invitations" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none
                         data-[state=active]:border-primary data-[state=active]:border-b-2
                         rounded-none px-5 py-2 font-medium relative">
              Invitations
              {invitations.length > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-5 w-5 text-xs font-bold text-white bg-[hsl(var(--teal))] rounded-full">
                  {invitations.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="trips" className="space-y-6 pt-2 mt-0">
            <YourTripsTab 
              trips={trips} 
              onCreateTrip={handleCreateTrip} 
              onTripClick={handleTripClick}
            />
          </TabsContent>
          
          <TabsContent value="invitations" className="space-y-6 pt-2 mt-0">
            <InvitationsTab 
              invitations={invitations} 
              onTripClick={handleTripClick}
            />
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