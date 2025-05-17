'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation';
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
import { ExpensesTab } from '@/components/ExpensesTab';
import { PollsTab } from '@/components/PollsTab';
import { Avatar } from '../../../components/ui/avatar';
import { AvatarFallback } from '../../../components/ui/avatar';
import { Badge } from '../../../components/ui/badge';
import { SidebarNav } from '@/components/SidebarNav';
import { getTripCoverSignedUrl } from '../../../lib/supabase';
import Image from 'next/image';

export default function TripDetails() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user, user_id, loading } = useAuth();
  
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [userRole, setUserRole] = useState<'planner' | 'guest' | 'viewer' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'overview');
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

  // When activeTab changes, update the URL (replace, don't push)
  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (activeTab && activeTab !== currentTab) {
      const newParams = new URLSearchParams(Array.from(searchParams.entries()));
      newParams.set('tab', activeTab);
      router.replace(`${pathname}?${newParams.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="flex flex-col">
            {/* Trip Details Card */}
            <Card className="border rounded-lg shadow-sm">
              <CardHeader>
                <CardTitle>Trip Details</CardTitle>
              </CardHeader>
              <CardContent>
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
            {/* RSVP Status Card */}
            <Card className="border rounded-lg shadow-sm mt-6">
              <CardHeader>
                <CardTitle>Your Status</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const currentMember = members.find(m => m.user_id === user_id);
                  if (!currentMember) return <p>Error: Could not find your trip membership</p>;
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
        );
      case 'travel':
        return <TravelDocumentsTab tripId={tripId} currentUserId={user_id || ''} userRole={userRole || 'viewer'} />;
      case 'lodging':
        return <LodgingDocumentsTab tripId={tripId} currentUserId={user_id || ''} userRole={userRole || 'viewer'} />;
      case 'itinerary':
        return <ItineraryTab trip={trip} tripId={tripId} currentUserId={user_id || ''} userRole={userRole || 'viewer'} members={members} />;
      case 'guests':
        return (
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Guest List</CardTitle>
              <CardDescription>Manage trip attendees</CardDescription>
            </CardHeader>
            <CardContent className="w-full overflow-x-hidden">
              <div className="space-y-4 w-full">
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
                    <div className="divide-y w-full">
                      {members.map(member => (
                        <div key={member.user_id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 w-full">
                          <div className="flex items-center space-x-3 flex-1 min-w-0 w-full">
                            <Avatar>
                              <AvatarFallback>
                                {member.user.first_name?.[0]}{member.user.last_name?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 w-full">
                              <p className="font-medium truncate w-full">{member.user.first_name} {member.user.last_name}</p>
                              <p className="text-sm text-gray-500 truncate w-full">{member.role === 'planner' ? 'Trip Organizer' : 'Guest'}</p>
                            </div>
                          </div>
                          <Badge className={`${getRSVPBadgeColor(member.rsvp_status)} flex items-center w-auto flex-shrink-0 max-w-[12ch] sm:max-w-full mt-2 sm:mt-0`}>
                            {getRSVPIcon(member.rsvp_status)}
                            <span className="ml-1 truncate">
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
                    <div className="divide-y w-full">
                      {members
                        .filter(member => member.rsvp_status === 'going')
                        .map(member => (
                          <div key={member.user_id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 w-full">
                            <div className="flex items-center space-x-3 flex-1 min-w-0 w-full">
                              <Avatar>
                                <AvatarFallback>
                                  {member.user.first_name?.[0]}{member.user.last_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 w-full">
                                <p className="font-medium truncate w-full">{member.user.first_name} {member.user.last_name}</p>
                                <p className="text-sm text-gray-500 truncate w-full">{member.role === 'planner' ? 'Trip Organizer' : 'Guest'}</p>
                              </div>
                            </div>
                            <Badge className="bg-green-500 flex items-center w-auto flex-shrink-0 max-w-[12ch] sm:max-w-full mt-2 sm:mt-0">
                              <ThumbsUp className="h-4 w-4" />
                              <span className="ml-1 truncate">Going</span>
                            </Badge>
                          </div>
                        ))}
                        {members.filter(member => member.rsvp_status === 'going').length === 0 && (
                          <p className="py-4 text-center text-gray-500">No confirmed guests</p>
                        )}
                    </div>
                  </TabsContent>
                  <TabsContent value="maybe" className="mt-4">
                    <div className="divide-y w-full">
                      {members
                        .filter(member => member.rsvp_status === 'maybe')
                        .map(member => (
                          <div key={member.user_id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 w-full">
                            <div className="flex items-center space-x-3 flex-1 min-w-0 w-full">
                              <Avatar>
                                <AvatarFallback>
                                  {member.user.first_name?.[0]}{member.user.last_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 w-full">
                                <p className="font-medium truncate w-full">{member.user.first_name} {member.user.last_name}</p>
                                <p className="text-sm text-gray-500 truncate w-full">{member.role === 'planner' ? 'Trip Organizer' : 'Guest'}</p>
                              </div>
                            </div>
                            <Badge className="bg-yellow-500 flex items-center w-auto flex-shrink-0 max-w-[12ch] sm:max-w-full mt-2 sm:mt-0">
                              <HelpCircle className="h-4 w-4" />
                              <span className="ml-1 truncate">Maybe</span>
                            </Badge>
                          </div>
                        ))}
                        {members.filter(member => member.rsvp_status === 'maybe').length === 0 && (
                          <p className="py-4 text-center text-gray-500">No guests have responded with 'Maybe'</p>
                        )}
                    </div>
                  </TabsContent>
                  <TabsContent value="not_going" className="mt-4">
                    <div className="divide-y w-full">
                      {members
                        .filter(member => member.rsvp_status === 'not_going')
                        .map(member => (
                          <div key={member.user_id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 w-full">
                            <div className="flex items-center space-x-3 flex-1 min-w-0 w-full">
                              <Avatar>
                                <AvatarFallback>
                                  {member.user.first_name?.[0]}{member.user.last_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 w-full">
                                <p className="font-medium truncate w-full">{member.user.first_name} {member.user.last_name}</p>
                                <p className="text-sm text-gray-500 truncate w-full">{member.role === 'planner' ? 'Trip Organizer' : 'Guest'}</p>
                              </div>
                            </div>
                            <Badge className="bg-red-500 flex items-center w-auto flex-shrink-0 max-w-[12ch] sm:max-w-full mt-2 sm:mt-0">
                              <ThumbsDown className="h-4 w-4" />
                              <span className="ml-1 truncate">Not Going</span>
                            </Badge>
                          </div>
                        ))}
                        {members.filter(member => member.rsvp_status === 'not_going').length === 0 && (
                          <p className="py-4 text-center text-gray-500">No guests have declined</p>
                        )}
                    </div>
                  </TabsContent>
                  <TabsContent value="pending" className="mt-4">
                    <div className="divide-y w-full">
                      {members
                        .filter(member => member.rsvp_status === 'pending')
                        .map(member => (
                          <div key={member.user_id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 w-full">
                            <div className="flex items-center space-x-3 flex-1 min-w-0 w-full">
                              <Avatar>
                                <AvatarFallback>
                                  {member.user.first_name?.[0]}{member.user.last_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 w-full">
                                <p className="font-medium truncate w-full">{member.user.first_name} {member.user.last_name}</p>
                                <p className="text-sm text-gray-500 truncate w-full">{member.role === 'planner' ? 'Trip Organizer' : 'Guest'}</p>
                              </div>
                            </div>
                            <Badge className="bg-gray-500 flex items-center w-auto flex-shrink-0 max-w-[12ch] sm:max-w-full mt-2 sm:mt-0">
                              <Clock className="h-4 w-4" />
                              <span className="ml-1 truncate">Pending</span>
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
                      <div className="divide-y w-full">
                        {members
                          .filter(member => member.rsvp_status === 'waitlist')
                          .map(member => (
                            <div key={member.user_id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 w-full">
                              <div className="flex items-center space-x-3 flex-1 min-w-0 w-full">
                                <Avatar>
                                  <AvatarFallback>
                                    {member.user.first_name?.[0]}{member.user.last_name?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 w-full">
                                  <p className="font-medium truncate w-full">{member.user.first_name} {member.user.last_name}</p>
                                  <p className="text-sm text-gray-500 truncate w-full">{member.role === 'planner' ? 'Trip Organizer' : 'Guest'}</p>
                                </div>
                              </div>
                              <Badge className="bg-purple-500 flex items-center w-auto flex-shrink-0 max-w-[12ch] sm:max-w-full mt-2 sm:mt-0">
                                <Users className="h-4 w-4" />
                                <span className="ml-1 truncate">Waitlisted</span>
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
        );
      case 'expenses':
        return <ExpensesTab tripId={tripId} currentUserId={user_id || ''} userRole={userRole || 'viewer'} members={members} />;
      case 'todos':
        return <TodoListTab tripId={tripId} currentUserId={user_id || ''} userRole={userRole || 'viewer'} members={members} />;
      case 'map':
        return <MapTab tripId={tripId} userRole={userRole || 'viewer'} />;
      case 'polls':
        return <PollsTab tripId={tripId} currentUserId={user_id || ''} userRole={userRole || 'viewer'} members={members} />;
      default:
        return null;
    }
  };

  // Helper component to display a trip cover image using a signed URL
  function TripCoverImage({ filePath }: { filePath: string }) {
    const [signedUrl, setSignedUrl] = React.useState<string | null>(null);
    React.useEffect(() => {
      let isMounted = true;
      getTripCoverSignedUrl(filePath).then((url) => {
        if (isMounted) setSignedUrl(url);
      });
      return () => { isMounted = false; };
    }, [filePath]);
    if (!filePath) return null;
    if (!signedUrl) {
      return <div className="w-full h-[180px] bg-muted flex items-center justify-center text-xs text-muted-foreground rounded-md mb-4">Loading...</div>;
    }
    return (
      <div className="w-full h-[180px] bg-muted relative rounded-md mb-4">
        <Image
          src={signedUrl}
          alt="Trip Cover"
          fill
          style={{ objectFit: 'cover' }}
          className="rounded-md"
          sizes="600px"
        />
      </div>
    );
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1">
        {/* Sidebar Navigation */}
        <SidebarNav 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
        />
        
        {/* Main Content Area */}
        <div className="flex-1 p-4 md:p-6">
          {/* Trip Header */}
          <div className="flex flex-col justify-between items-start mb-6">
            {/* Trip Cover Photo */}
            {trip?.cover_photo_path ? (
              <TripCoverImage filePath={trip.cover_photo_path} />
            ) : null}
            <div>
              <h1 className="text-3xl font-bold">{trip?.name}</h1>
              <p className="text-gray-500">{trip?.description}</p>
              <div className="flex flex-wrap items-center mt-2 gap-4">
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

          {/* Tab contents */}
          <Card className="mb-4">
            <CardContent className="p-4">
              {renderTabContent()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}