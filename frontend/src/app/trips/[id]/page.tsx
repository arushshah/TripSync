'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { Trip, TripMember, ActivityFeedItem, RSVPStatus } from '../../../types';
import { api } from '../../../lib/api';
import { Header } from '../../../components/Header';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { 
  CalendarIcon, Share2, FileIcon, Building, 
  CalendarCheck, CheckSquare, ThumbsUp, HelpCircle, 
  ThumbsDown, Users, Clock, Calendar, MapPin, Wallet, Mail
} from 'lucide-react';
import { format } from 'date-fns';
import { TravelDocumentsTab } from '../../../components/TravelDocumentsTab';
import { LodgingDocumentsTab } from '../../../components/LodgingDocumentsTab';
// Fix import paths to use absolute paths instead of relative
import { TodoListTab } from '@/components/TodoListTab';
import { ItineraryTab } from '@/components/ItineraryTab';
import { MapTab } from '@/components/MapTab';
import { Avatar } from '../../../components/ui/avatar';
import { AvatarFallback } from '../../../components/ui/avatar';
import { Badge } from '../../../components/ui/badge';

export default function TripDetails() {
  const params = useParams();
  const router = useRouter();
  const { user, user_id, loading } = useAuth();
  
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [userRole, setUserRole] = useState<'planner' | 'guest' | 'viewer' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [pendingRSVP, setPendingRSVP] = useState<boolean>(false);
  const [isRSVPSubmitting, setIsRSVPSubmitting] = useState<boolean>(false);
  
  const tripId = params.id as string;

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else {
        fetchTripData();
      }
    }
  }, [loading, user, user_id, router, tripId]);
  
  useEffect(() => {
    if (tripId) {
      const link = generateInviteLink();
      setInviteLink(link);
    }
  }, [tripId]);
  
  useEffect(() => {
    // Check if the current user has pending status
    if (user_id && members.length > 0) {
      const currentMember = members.find(member => member.user_id === user_id);
      if (currentMember && currentMember.rsvp_status === 'pending') {
        setPendingRSVP(true);
      } else {
        setPendingRSVP(false);
      }
    }
  }, [user_id, members]);

  const fetchTripData = async () => {
    if (!user || !tripId || !user_id) return;

    try {
      setIsLoading(true);
      
      // Use API client to fetch trip data
      const tripData = await api.getTripById(tripId);
      setTrip(tripData);

      // Get user role from trip members
      // Use the user_id which matches the backend's user_id
      const currentMember = tripData.members?.find(member => member.user_id === user_id);
      if (currentMember) {
        setUserRole(currentMember.role as 'planner' | 'guest' | 'viewer');
      } else {
        console.error('User is not a member of this trip', { 
          user_id,
          members: tripData.members
        });
        // This shouldn't happen with proper API auth, but just in case
        router.push('/dashboard');
      }

      setMembers(tripData.members || []);
    } catch (error) {
      console.error('Failed to fetch trip data', error);
      setError('Failed to fetch trip data');
    } finally {
      setIsLoading(false);
    }
  };

  const generateInviteLink = () => {
    return `${window.location.origin}/trips/invite/${tripId}`;
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    });
  };

  const handleRSVP = async (status: RSVPStatus) => {
    if (!user || !tripId || !user_id) return;

    try {
      setIsRSVPSubmitting(true);
      await api.updateRSVPStatus(tripId, user_id, status);
      const updatedMembers = members.map(member => 
        member.user_id === user_id ? { ...member, rsvp_status: status } : member
      );
      setMembers(updatedMembers);
      setPendingRSVP(false);
    } catch (error) {
      console.error('Failed to update RSVP status', error);
      setError('Failed to update RSVP status');
    } finally {
      setIsRSVPSubmitting(false);
    }
  };

  // Helper function to get the RSVP badge color
  const getRSVPBadgeColor = (status: RSVPStatus) => {
    switch (status) {
      case 'going': return 'bg-green-500';
      case 'not_going': return 'bg-red-500';
      case 'maybe': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  // Helper function to get the RSVP icon
  const getRSVPIcon = (status: RSVPStatus) => {
    switch (status) {
      case 'going': return <ThumbsUp className="h-4 w-4" />;
      case 'not_going': return <ThumbsDown className="h-4 w-4" />;
      case 'maybe': return <HelpCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div>
      <Header />
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold">{trip?.name}</h1>
            <p className="text-gray-500">{trip?.description}</p>
            <div className="flex items-center mt-2 space-x-4">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                <span>{format(new Date(trip?.start_date || ''), 'MMM d, yyyy')}</span>
                {trip?.end_date && (
                  <span> - {format(new Date(trip?.end_date || ''), 'MMM d, yyyy')}</span>
                )}
              </div>
              <div className="flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                <span>{trip?.location}</span>
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            {userRole === 'planner' && (
              <Button 
                variant="outline" 
                onClick={() => router.push(`/trips/${tripId}/edit`)}
              >
                Edit Trip
              </Button>
            )}
            <Button 
              onClick={handleCopyInviteLink}
            >
              <Share2 className="h-4 w-4 mr-2" />
              {inviteCopied ? 'Copied!' : 'Share'}
            </Button>
          </div>
        </div>

        {/* Responsive tabulated menu with horizontal scrolling on smaller screens */}
        <div className="mb-6 flex justify-center w-full">
          <div className="w-full">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full flex flex-wrap justify-between bg-muted/20 rounded-xl shadow-sm px-2 py-3 gap-2 mb-6">
                <TabsTrigger value="overview" className="flex-1 min-w-[140px] px-4 py-3 rounded-md text-sm hover:bg-muted transition">
                  <CalendarIcon className="h-4 w-4 mr-2" /> Overview
                </TabsTrigger>
                <TabsTrigger value="guests" className="flex-1 min-w-[140px] px-4 py-3 rounded-md text-sm hover:bg-muted transition">
                  <Users className="h-4 w-4 mr-2" /> Guests
                </TabsTrigger>
                <TabsTrigger value="travel" className="flex-1 min-w-[140px] px-4 py-3 rounded-md text-sm hover:bg-muted transition">
                  <FileIcon className="h-4 w-4 mr-2" /> Travel
                </TabsTrigger>
                <TabsTrigger value="lodging" className="flex-1 min-w-[140px] px-4 py-3 rounded-md text-sm hover:bg-muted transition">
                  <Building className="h-4 w-4 mr-2" /> Lodging
                </TabsTrigger>
                <TabsTrigger value="itinerary" className="flex-1 min-w-[140px] px-4 py-3 rounded-md text-sm hover:bg-muted transition">
                  <CalendarCheck className="h-4 w-4 mr-2" /> Itinerary
                </TabsTrigger>
                <TabsTrigger value="expenses" className="flex-1 min-w-[140px] px-4 py-3 rounded-md text-sm hover:bg-muted transition">
                  <Wallet className="h-4 w-4 mr-2" /> Expenses
                </TabsTrigger>
                <TabsTrigger value="todos" className="flex-1 min-w-[140px] px-4 py-3 rounded-md text-sm hover:bg-muted transition">
                  <CheckSquare className="h-4 w-4 mr-2" /> To-dos
                </TabsTrigger>
                <TabsTrigger value="map" className="flex-1 min-w-[140px] px-4 py-3 rounded-md text-sm hover:bg-muted transition">
                  <MapPin className="h-4 w-4 mr-2" /> Map
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>




        {/* Tab contents separated from the menu */}
        <Card className="mb-4">
          <CardContent className="p-4">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* First Section: Trip Details */}
                <div>
                  <h2 className="text-xl font-semibold mb-4">Trip Details</h2>
                  <Card>
                    <CardContent className="p-6">
                      <div className="grid gap-4">
                        <div className="flex flex-col md:flex-row md:justify-between">
                          <div>
                            <h3 className="font-medium text-gray-500">Trip Name</h3>
                            <p className="text-lg">{trip?.name}</p>
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-500">Organizer</h3>
                            <p className="text-lg">{members.find(m => m.role === 'planner')?.user?.first_name} {members.find(m => m.role === 'planner')?.user?.last_name}</p>
                          </div>
                        </div>
                        <div className="flex flex-col md:flex-row md:justify-between">
                          <div>
                            <h3 className="font-medium text-gray-500">Dates</h3>
                            <p className="text-lg">
                              {format(new Date(trip?.start_date || ''), 'MMMM d, yyyy')} 
                              {trip?.end_date && <> - {format(new Date(trip?.end_date), 'MMMM d, yyyy')}</>}
                            </p>
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-500">Location</h3>
                            <p className="text-lg">{trip?.location}</p>
                          </div>
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-500">Description</h3>
                          <p>{trip?.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Second Section: User Status & RSVP */}
                <div>
                  <h2 className="text-xl font-semibold mb-4">Your Status</h2>
                  <Card>
                    <CardContent className="p-6">
                      {/* Find current user from members array */}
                      {(() => {
                        const currentMember = members.find(m => m.user_id === user_id);
                        if (!currentMember) return <p>Error: Could not find your trip membership</p>;
                        
                        // Check if user is the planner (can't change RSVP)
                        const isPlanner = currentMember.role === 'planner';
                        
                        return (
                          <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                              <div>
                                <h3 className="font-medium text-gray-500">Your RSVP Status</h3>
                                <div className="mt-1 flex items-center">
                                  <Badge className={`${getRSVPBadgeColor(currentMember.rsvp_status)} flex items-center`}>
                                    {getRSVPIcon(currentMember.rsvp_status)}
                                    <span className="ml-1">
                                      {currentMember.rsvp_status === 'going' ? 'Going' : 
                                       currentMember.rsvp_status === 'not_going' ? 'Not Going' : 
                                       currentMember.rsvp_status === 'maybe' ? 'Maybe' : 
                                       currentMember.rsvp_status === 'waitlist' ? 'Waitlisted' : 'Pending'}
                                    </span>
                                  </Badge> 
                                </div>
                              </div>
                              
                              {!isPlanner && (
                                <div className="mt-3 sm:mt-0">
                                  <h3 className="font-medium text-gray-500 mb-1">Update Your Status</h3>
                                  <div className="flex flex-wrap gap-2">
                                    <Button 
                                      size="sm"
                                      variant={currentMember.rsvp_status === 'going' ? 'default' : 'outline'}
                                      className={currentMember.rsvp_status === 'going' ? 'bg-green-600 hover:bg-green-700' : ''}
                                      onClick={() => handleRSVP('going')}
                                      disabled={isRSVPSubmitting}
                                    >
                                      <ThumbsUp className="h-4 w-4 mr-1" /> Going
                                    </Button>
                                    <Button 
                                      size="sm"
                                      variant={currentMember.rsvp_status === 'maybe' ? 'default' : 'outline'}
                                      className={currentMember.rsvp_status === 'maybe' ? 'bg-yellow-500 hover:bg-yellow-600' : 'border-yellow-500 text-yellow-700 hover:bg-yellow-50'}
                                      onClick={() => handleRSVP('maybe')}
                                      disabled={isRSVPSubmitting}
                                    >
                                      <HelpCircle className="h-4 w-4 mr-1" /> Maybe
                                    </Button>
                                    <Button 
                                      size="sm"
                                      variant={currentMember.rsvp_status === 'not_going' ? 'default' : 'outline'}
                                      className={currentMember.rsvp_status === 'not_going' ? 'bg-red-500 hover:bg-red-600' : 'border-red-500 text-red-700 hover:bg-red-50'}
                                      onClick={() => handleRSVP('not_going')}
                                      disabled={isRSVPSubmitting}
                                    >
                                      <ThumbsDown className="h-4 w-4 mr-1" /> Not Going
                                    </Button>
                                  </div>
                                </div>
                              )}
                              
                              {isPlanner && (
                                <div className="mt-2 text-sm text-gray-500 italic">
                                  As the trip organizer, you're automatically marked as going
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
            
            {activeTab === 'travel' && (
              <TravelDocumentsTab tripId={tripId} currentUserId={user_id || ''} userRole={userRole || 'viewer'} />
            )}
            
            {activeTab === 'lodging' && (
              <LodgingDocumentsTab tripId={tripId} currentUserId={user_id || ''} userRole={userRole || 'viewer'} />
            )}

            {activeTab === 'itinerary' && (
              <ItineraryTab
                trip={trip}
                tripId={tripId} 
                currentUserId={user_id || ''}
                userRole={userRole || 'viewer'} 
                members={members}
              />
            )}

            {activeTab === 'guests' && (
              <Card>
                <CardHeader>
                  <CardTitle>Guest List</CardTitle>
                  <CardDescription>Manage trip attendees</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {userRole === 'planner' && (
                      <div className="mb-4">
                        <Button onClick={handleCopyInviteLink}>
                          <Mail className="h-4 w-4 mr-2" />
                          {inviteCopied ? 'Invitation Link Copied!' : 'Invite Friends'}
                        </Button>
                      </div>
                    )}
                    
                    <Tabs defaultValue="all" className="w-full">
                      <TabsList className="w-full overflow-x-auto flex-nowrap whitespace-nowrap">
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="going">
                          <ThumbsUp className="h-4 w-4 mr-1" /> Going ({members.filter(m => m.rsvp_status === 'going').length})
                        </TabsTrigger>
                        <TabsTrigger value="maybe">
                          <HelpCircle className="h-4 w-4 mr-1" /> Maybe ({members.filter(m => m.rsvp_status === 'maybe').length})
                        </TabsTrigger>
                        <TabsTrigger value="not_going">
                          <ThumbsDown className="h-4 w-4 mr-1" /> Can't Go ({members.filter(m => m.rsvp_status === 'not_going').length})
                        </TabsTrigger>
                        <TabsTrigger value="pending">
                          <Clock className="h-4 w-4 mr-1" /> Invited ({members.filter(m => m.rsvp_status === 'pending').length})
                        </TabsTrigger>
                        {members.some(m => m.rsvp_status === 'waitlist') && (
                          <TabsTrigger value="waitlist">
                            <Users className="h-4 w-4 mr-1" /> Waitlisted ({members.filter(m => m.rsvp_status === 'waitlist').length})
                          </TabsTrigger>
                        )}
                      </TabsList>
                      
                      <TabsContent value="all" className="mt-4">
                        <div className="divide-y">
                          {members.map(member => (
                            <div key={member.user_id} className="py-3 flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Avatar>
                                  <AvatarFallback>
                                    {member.user.first_name?.[0]}{member.user.last_name?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{member.user.first_name} {member.user.last_name}</p>
                                  <p className="text-sm text-gray-500">{member.role === 'planner' ? 'Trip Organizer' : 'Guest'}</p>
                                </div>
                              </div>
                              <Badge className={`${getRSVPBadgeColor(member.rsvp_status)} flex items-center`}>
                                {getRSVPIcon(member.rsvp_status)}
                                <span className="ml-1">
                                  {member.rsvp_status === 'going' ? 'Going' : 
                                   member.rsvp_status === 'not_going' ? 'Not Going' : 
                                   member.rsvp_status === 'maybe' ? 'Maybe' : 
                                   member.rsvp_status === 'waitlist' ? 'Waitlisted' : 'Pending'}
                                </span>
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="going" className="mt-4">
                        <div className="divide-y">
                          {members
                            .filter(member => member.rsvp_status === 'going')
                            .map(member => (
                              <div key={member.user_id} className="py-3 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <Avatar>
                                    <AvatarFallback>
                                      {member.user.first_name?.[0]}{member.user.last_name?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">{member.user.first_name} {member.user.last_name}</p>
                                    <p className="text-sm text-gray-500">{member.role === 'planner' ? 'Trip Organizer' : 'Guest'}</p>
                                  </div>
                                </div>
                                <Badge className="bg-green-500 flex items-center">
                                  <ThumbsUp className="h-4 w-4" />
                                  <span className="ml-1">Going</span>
                                </Badge>
                              </div>
                            ))}
                            {members.filter(member => member.rsvp_status === 'going').length === 0 && (
                              <p className="py-4 text-center text-gray-500">No confirmed guests</p>
                            )}
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="maybe" className="mt-4">
                        <div className="divide-y">
                          {members
                            .filter(member => member.rsvp_status === 'maybe')
                            .map(member => (
                              <div key={member.user_id} className="py-3 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <Avatar>
                                    <AvatarFallback>
                                      {member.user.first_name?.[0]}{member.user.last_name?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">{member.user.first_name} {member.user.last_name}</p>
                                    <p className="text-sm text-gray-500">{member.role === 'planner' ? 'Trip Organizer' : 'Guest'}</p>
                                  </div>
                                </div>
                                <Badge className="bg-yellow-500 flex items-center">
                                  <HelpCircle className="h-4 w-4" />
                                  <span className="ml-1">Maybe</span>
                                </Badge>
                              </div>
                            ))}
                            {members.filter(member => member.rsvp_status === 'maybe').length === 0 && (
                              <p className="py-4 text-center text-gray-500">No guests have responded with 'Maybe'</p>
                            )}
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="not_going" className="mt-4">
                        <div className="divide-y">
                          {members
                            .filter(member => member.rsvp_status === 'not_going')
                            .map(member => (
                              <div key={member.user_id} className="py-3 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <Avatar>
                                    <AvatarFallback>
                                      {member.user.first_name?.[0]}{member.user.last_name?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">{member.user.first_name} {member.user.last_name}</p>
                                    <p className="text-sm text-gray-500">{member.role === 'planner' ? 'Trip Organizer' : 'Guest'}</p>
                                  </div>
                                </div>
                                <Badge className="bg-red-500 flex items-center">
                                  <ThumbsDown className="h-4 w-4" />
                                  <span className="ml-1">Not Going</span>
                                </Badge>
                              </div>
                            ))}
                            {members.filter(member => member.rsvp_status === 'not_going').length === 0 && (
                              <p className="py-4 text-center text-gray-500">No guests have declined</p>
                            )}
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="pending" className="mt-4">
                        <div className="divide-y">
                          {members
                            .filter(member => member.rsvp_status === 'pending')
                            .map(member => (
                              <div key={member.user_id} className="py-3 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <Avatar>
                                    <AvatarFallback>
                                      {member.user.first_name?.[0]}{member.user.last_name?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">{member.user.first_name} {member.user.last_name}</p>
                                    <p className="text-sm text-gray-500">{member.role === 'planner' ? 'Trip Organizer' : 'Guest'}</p>
                                  </div>
                                </div>
                                <Badge className="bg-gray-500 flex items-center">
                                  <Clock className="h-4 w-4" />
                                  <span className="ml-1">Pending</span>
                                </Badge>
                              </div>
                            ))}
                            {members.filter(member => member.rsvp_status === 'pending').length === 0 && (
                              <p className="py-4 text-center text-gray-500">No pending invitations</p>
                            )}
                        </div>
                      </TabsContent>
                      
                      {members.some(m => m.rsvp_status === 'waitlist') && (
                        <TabsContent value="waitlist" className="mt-4">
                          <div className="divide-y">
                            {members
                              .filter(member => member.rsvp_status === 'waitlist')
                              .map(member => (
                                <div key={member.user_id} className="py-3 flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <Avatar>
                                      <AvatarFallback>
                                        {member.user.first_name?.[0]}{member.user.last_name?.[0]}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-medium">{member.user.first_name} {member.user.last_name}</p>
                                      <p className="text-sm text-gray-500">{member.role === 'planner' ? 'Trip Organizer' : 'Guest'}</p>
                                    </div>
                                  </div>
                                  <Badge className="bg-purple-500 flex items-center">
                                    <Users className="h-4 w-4" />
                                    <span className="ml-1">Waitlisted</span>
                                  </Badge>
                                </div>
                              ))}
                          </div>
                        </TabsContent>
                      )}
                    </Tabs>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {activeTab === 'expenses' && (
              <Card>
                <CardHeader>
                  <CardTitle>Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Expense tracking and splitting content will go here</p>
                </CardContent>
              </Card>
            )}
            
            {activeTab === 'todos' && (
              <TodoListTab 
                tripId={tripId}
                currentUserId={user_id || ''}
                userRole={userRole || 'viewer'}
                members={members}
              />
            )}
            
            {activeTab === 'map' && (
              <MapTab
                tripId={tripId}
                userRole={userRole || 'viewer'}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}