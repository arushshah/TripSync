'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { Trip, TripMember, ActivityFeedItem } from '../../../types';
import { api } from '../../../lib/api';
import { Header } from '../../../components/Header';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { CalendarIcon, MapPinIcon, Clipboard, Share2, FileIcon, Building, CalendarCheck, CheckSquare, MapPin, Wallet } from 'lucide-react';
import { Avatar, AvatarFallback } from '../../../components/ui/avatar';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';

export default function TripDetails() {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [userRole, setUserRole] = useState<'planner' | 'guest' | 'viewer' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('details');
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  
  const tripId = params.id as string;

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
    if (tripId) {
      const link = generateInviteLink();
      setInviteLink(link);
    }
  }, [tripId]);

  const fetchTripData = async () => {
    if (!user || !tripId) return;

    try {
      setIsLoading(true);
      
      // Use API client to fetch trip data
      const tripData = await api.getTripById(tripId);
      setTrip(tripData);

      // Get user role from trip members
      const currentMember = tripData.members?.find((member: any) => member.user_id === user.uid);
      if (currentMember) {
        setUserRole(currentMember.role as 'planner' | 'guest' | 'viewer');
      } else {
        // This shouldn't happen with proper API auth, but just in case
        router.push('/dashboard');
      }

      setMembers(tripData.members || []);

    } catch (err: any) {
      console.error('Error fetching trip data:', err);
      setError(err.message || 'Failed to load trip data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!user || !tripId) return;

    try {
      const response = await api.generateTripInvite(tripId);
      navigator.clipboard.writeText(response.invite_url);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 3000);
    } catch (err: any) {
      console.error('Error generating invite:', err);
      alert(err.message || 'Failed to generate invite link');
    }
  };

  const generateInviteLink = () => {
    return `${window.location.origin}/trips/invite/${tripId}`;
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 3000);
  };
  
  // Function to get initials for avatar
  const getInitials = (name: string) => {
    if (!name) return 'G';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="flex flex-col items-center">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="mt-4 text-muted-foreground">Loading trip details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push('/dashboard')} className="w-full">
              Return to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 py-6">
        {trip && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{trip.name}</h1>
                <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                  <MapPinIcon className="h-4 w-4" />
                  <span>{trip.location}</span>
                </div>
              </div>
              
              {userRole === 'planner' && (
                <Button 
                  variant="teal"
                  onClick={() => router.push(`/trips/${tripId}/edit`)}
                >
                  Edit Trip
                </Button>
              )}
            </div>

            <Tabs defaultValue="details" onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4 md:grid-cols-8 lg:w-auto">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="guests">Guests</TabsTrigger>
                <TabsTrigger value="travel-docs">Travel</TabsTrigger>
                <TabsTrigger value="accommodation-docs">Lodging</TabsTrigger>
                <TabsTrigger value="itinerary">Itinerary</TabsTrigger>
                <TabsTrigger value="todo">To-Do</TabsTrigger>
                <TabsTrigger value="map">Map</TabsTrigger>
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Trip Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="text-sm font-medium">Dates</div>
                      <div className="flex items-center mt-1.5">
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {trip.start_date && trip.end_date ? (
                          <span>
                            {format(new Date(trip.start_date), 'MMM d')} - 
                            {format(new Date(trip.end_date), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No dates set</span>
                        )}
                      </div>
                    </div>
                    
                    {trip.description && (
                      <div>
                        <div className="text-sm font-medium">About this trip</div>
                        <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">
                          {trip.description}
                        </p>
                      </div>
                    )}
                    
                    {trip.guest_limit && (
                      <div>
                        <div className="text-sm font-medium">Guest Limit</div>
                        <p className="mt-1.5 text-sm text-muted-foreground">
                          {trip.guest_limit} people
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Invite Others</CardTitle>
                    <CardDescription>Share this trip with friends and family</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-4">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button className="gap-2" variant="teal">
                            <Share2 className="h-4 w-4" />
                            Share Trip
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Share Trip</DialogTitle>
                            <DialogDescription>
                              Copy this link to invite others to join your trip
                            </DialogDescription>
                          </DialogHeader>
                          <div className="flex items-center space-x-2">
                            <Input
                              readOnly
                              value={inviteLink}
                              className="flex-1"
                            />
                            <Button
                              onClick={copyInviteLink}
                              variant="teal"
                              className="shrink-0"
                            >
                              {inviteCopied ? "Copied!" : "Copy"}
                            </Button>
                          </div>
                          <DialogFooter className="mt-4">
                            <Button onClick={handleInvite}>Generate New Invite</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="guests" className="space-y-6 mt-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Guests</CardTitle>
                      <CardDescription>People joining this trip</CardDescription>
                    </div>
                    <Button 
                      variant="teal" 
                      className="gap-2"
                      onClick={handleInvite}
                    >
                      <Share2 className="h-4 w-4" />
                      Invite
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-medium mb-3">Going ({members.filter(m => m.rsvp_status === 'going').length})</h3>
                        {members
                          .filter(member => member.rsvp_status === 'going')
                          .map(member => (
                            <div key={member.id} className="flex items-center justify-between py-2 border-b">
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarFallback>
                                    {getInitials(`${member.user?.first_name} ${member.user?.last_name}` || 'Guest')}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">{member.user?.first_name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {member.role === 'planner' ? 'Planner' : member.role === 'guest' ? 'Guest' : 'Viewer'}
                                  </div>
                                </div>
                              </div>
                              
                              {userRole === 'planner' && member.user_id !== user?.uid && (
                                <Button variant="ghost" size="sm">
                                  Manage
                                </Button>
                              )}
                            </div>
                          ))}
                          
                        {members.filter(m => m.rsvp_status === 'going').length === 0 && (
                          <p className="text-sm text-muted-foreground">No confirmed guests yet</p>
                        )}
                      </div>
                      
                      {members.some(member => member.rsvp_status === 'maybe') && (
                        <div>
                          <h3 className="text-lg font-medium mb-3">Maybe ({members.filter(m => m.rsvp_status === 'maybe').length})</h3>
                          {/* Similar layout as above for Maybe status members */}
                        </div>
                      )}
                      
                      {/* Not Going and Waitlist sections follow the same pattern */}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* The remaining tabs with "Coming Soon" placeholders */}
              {['travel-docs', 'accommodation-docs', 'itinerary', 'todo', 'map', 'expenses'].map(tabValue => (
                <TabsContent key={tabValue} value={tabValue} className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        {tabValue === 'travel-docs' && <div className="flex items-center gap-2"><FileIcon className="h-5 w-5" /> Travel Documents</div>}
                        {tabValue === 'accommodation-docs' && <div className="flex items-center gap-2"><Building className="h-5 w-5" /> Accommodation</div>}
                        {tabValue === 'itinerary' && <div className="flex items-center gap-2"><CalendarCheck className="h-5 w-5" /> Itinerary</div>}
                        {tabValue === 'todo' && <div className="flex items-center gap-2"><CheckSquare className="h-5 w-5" /> To-Do List</div>}
                        {tabValue === 'map' && <div className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Trip Map</div>}
                        {tabValue === 'expenses' && <div className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Expenses</div>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <p className="text-lg text-muted-foreground">This feature is coming soon!</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          We're working on making your trip planning experience even better.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}