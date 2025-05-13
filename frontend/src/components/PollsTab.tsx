'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth/AuthProvider';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardFooter 
} from './ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from './ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './ui/form';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { 
  AlertTriangle, 
  Calendar, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Edit, 
  HelpCircle, 
  Loader2, 
  Plus, 
  Trash, 
  Users,
  VoteIcon
} from 'lucide-react';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar as CalendarComponent } from './ui/calendar';
import { cn } from '../lib/utils';
import { TripMember } from '../types';

// Define Poll types
interface PollOption {
  id: string;
  poll_id: string;
  text: string;
  created_at: string;
  vote_count: number;
  votes?: PollVote[];
}

interface PollVote {
  id: number;
  option_id: string;
  user_id: string;
  created_at: string;
}

interface Poll {
  id: string;
  trip_id: string;
  creator_id: string;
  question: string;
  description: string | null;
  end_date: string | null;
  allow_multiple: boolean;
  created_at: string;
  updated_at: string | null;
  options?: PollOption[];
}

// Define the form schema for creating/editing a poll
const pollFormSchema = z.object({
  question: z.string().min(5, { message: "Question must be at least 5 characters" }),
  description: z.string().optional(),
  end_date: z.date().optional().nullable(),
  allow_multiple: z.boolean().default(false),
  audience: z.enum(['all', 'going']).default('all'),
  options: z.array(
    z.object({
      text: z.string().min(1, { message: "Option text is required" })
    })
  ).min(2, { message: "At least 2 options are required" })
});

type PollFormValues = z.infer<typeof pollFormSchema>;

// Props for the PollsTab component
interface PollsTabProps {
  tripId: string;
  currentUserId: string;
  userRole: 'planner' | 'guest' | 'viewer';
  members: TripMember[];
}

export function PollsTab({ tripId, currentUserId, userRole, members }: PollsTabProps) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const [pollToDelete, setPollToDelete] = useState<Poll | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [votingPollId, setVotingPollId] = useState<string | null>(null);
  // Add state for poll voting options at the component level
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [selectedOption, setSelectedOption] = useState<Record<string, string>>({});
  const { user } = useAuth();

  const form = useForm<PollFormValues>({
    resolver: zodResolver(pollFormSchema),
    defaultValues: {
      question: '',
      description: '',
      end_date: null,
      allow_multiple: false,
      audience: 'all',
      options: [{ text: '' }, { text: '' }]
    }
  });

  // Load polls when component mounts
  useEffect(() => {
    fetchPolls();
  }, [tripId]);

  // Fetch polls for the current trip
  const fetchPolls = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.getPolls(tripId);
      console.log('Fetched polls:', response);
      setPolls(response);
    } catch (err) {
      console.error('Failed to fetch polls:', err);
      setError('Failed to load polls. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Handle creating a new poll
  const handleCreatePoll = async (values: PollFormValues) => {
    try {
      setSubmitting(true);
      
      // Format the data for the API
      const pollData = {
        question: values.question,
        description: values.description || null,
        end_date: values.end_date ? values.end_date.toISOString() : null,
        allow_multiple: values.allow_multiple,
        audience: values.audience,
        options: values.options.map(option => option.text)
      };

      await api.createPoll(tripId, pollData);
      
      // Refresh polls
      await fetchPolls();
      setShowCreateDialog(false);
      form.reset();
    } catch (err) {
      console.error('Failed to create poll:', err);
      setError('Failed to create poll. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle editing a poll
  const handleEditPoll = async (values: PollFormValues) => {
    if (!editingPoll) return;

    try {
      setSubmitting(true);
      
      // Format the data for the API
      const pollData = {
        question: values.question,
        description: values.description || null,
        end_date: values.end_date ? values.end_date.toISOString() : null,
        allow_multiple: values.allow_multiple,
        audience: values.audience,
        // We need to handle options differently for editing
        // The API needs to know which options are new, which are updated, and which to delete
        options: values.options.map(option => option.text)
      };

      await api.updatePoll(tripId, editingPoll.id, pollData);
      
      // Refresh polls
      await fetchPolls();
      setEditingPoll(null);
    } catch (err) {
      console.error('Failed to update poll:', err);
      setError('Failed to update poll. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete a poll
  const handleDeletePoll = async () => {
    if (!pollToDelete) return;

    try {
      setSubmitting(true);
      await api.deletePoll(tripId, pollToDelete.id);
      
      // Remove the deleted poll from the list
      setPolls(polls.filter(poll => poll.id !== pollToDelete.id));
      setShowDeleteDialog(false);
      setPollToDelete(null);
    } catch (err) {
      console.error('Failed to delete poll:', err);
      setError('Failed to delete poll. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit a vote for a poll
  const handleVote = async (pollId: string, optionIds: string[]) => {
    try {
      setVotingPollId(pollId);
      
      // Submit vote to the API using the authenticated method
      await api.voteOnPoll(tripId, pollId, optionIds);
      
      // Refresh polls to update the vote counts
      await fetchPolls();
    } catch (err) {
      console.error('Failed to submit vote:', err);
      setError('Failed to submit vote. Please try again.');
    } finally {
      setVotingPollId(null);
    }
  };

  // Check if user has already voted for a poll
  const hasVoted = (poll: Poll): boolean => {
    if (!poll.options) return false;
    
    return poll.options.some(option => 
      option.votes?.some(vote => vote.user_id === currentUserId)
    );
  };

  // Get the options the user voted for
  const getUserVotedOptions = (poll: Poll): string[] => {
    if (!poll.options) return [];
    
    return poll.options
      .filter(option => option.votes?.some(vote => vote.user_id === currentUserId))
      .map(option => option.id);
  };

  // Handle opening the edit dialog
  const openEditDialog = (poll: Poll) => {
    setEditingPoll(poll);
    
    // Set form values from the poll
    form.reset({
      question: poll.question,
      description: poll.description || '',
      end_date: poll.end_date ? new Date(poll.end_date) : null,
      allow_multiple: poll.allow_multiple,
      audience: 'all', // We'll need to fetch this from the API or store it in the poll object
      options: poll.options?.map(option => ({ text: option.text })) || [{ text: '' }, { text: '' }]
    });
  };

  // Add an option field to the form
  const addOptionField = () => {
    const options = form.getValues('options');
    form.setValue('options', [...options, { text: '' }]);
  };

  // Remove an option field from the form
  const removeOptionField = (index: number) => {
    const options = form.getValues('options');
    if (options.length <= 2) return; // Ensure at least 2 options remain
    
    form.setValue('options', options.filter((_, i) => i !== index));
  };

  // Check if a user can vote in a poll based on audience setting
  const canVoteInPoll = (poll: Poll, audience: 'all' | 'going'): boolean => {
    // If audience is 'all', everyone can vote
    if (audience === 'all') return true;
    
    // If audience is 'going', check if the user's RSVP status is 'going'
    const currentMember = members.find(m => m.user_id === currentUserId);
    return currentMember?.rsvp_status === 'going';
  };

  // Render poll options for voting
  const renderPollVoteOptions = (poll: Poll) => {
    const userVoted = hasVoted(poll);
    const userVotedOptions = getUserVotedOptions(poll);
    
    if (poll.allow_multiple) {
      // Multiple selection (checkboxes)
      return (
        <div className="space-y-4">
          {poll.options?.map(option => (
            <div key={option.id} className="flex items-center space-x-2">
              <Checkbox 
                id={option.id} 
                checked={selectedOptions[poll.id]?.includes(option.id) || false}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedOptions(prev => ({
                      ...prev,
                      [poll.id]: [...(prev[poll.id] || []), option.id]
                    }));
                  } else {
                    setSelectedOptions(prev => ({
                      ...prev,
                      [poll.id]: (prev[poll.id] || []).filter(id => id !== option.id)
                    }));
                  }
                }}
                disabled={userVoted}
              />
              <Label htmlFor={option.id}>{option.text}</Label>
              <Badge variant="outline" className="ml-auto">
                {option.vote_count} vote{option.vote_count !== 1 ? 's' : ''}
              </Badge>
            </div>
          ))}
          
          {!userVoted && (
            <Button 
              onClick={() => handleVote(poll.id, selectedOptions[poll.id] || [])}
              disabled={(selectedOptions[poll.id] || []).length === 0 || votingPollId === poll.id}
              className="mt-2"
            >
              {votingPollId === poll.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <VoteIcon className="mr-2 h-4 w-4" />
                  Submit Vote
                </>
              )}
            </Button>
          )}
        </div>
      );
    } else {
      // Single selection (radio buttons)
      return (
        <div className="space-y-4">
          <RadioGroup 
            value={selectedOption[poll.id] || ''} 
            onValueChange={(value) => setSelectedOption(prev => ({
              ...prev,
              [poll.id]: value
            }))}
            disabled={userVoted}
          >
            {poll.options?.map(option => (
              <div key={option.id} className="flex items-center space-x-2">
                <RadioGroupItem 
                  value={option.id} 
                  id={option.id}
                  disabled={userVoted}
                />
                <Label htmlFor={option.id}>{option.text}</Label>
                <Badge variant="outline" className="ml-auto">
                  {option.vote_count} vote{option.vote_count !== 1 ? 's' : ''}
                </Badge>
              </div>
            ))}
          </RadioGroup>
          
          {!userVoted && (
            <Button 
              onClick={() => handleVote(poll.id, [selectedOption[poll.id]])}
              disabled={!selectedOption[poll.id] || votingPollId === poll.id}
              className="mt-2"
            >
              {votingPollId === poll.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <VoteIcon className="mr-2 h-4 w-4" />
                  Submit Vote
                </>
              )}
            </Button>
          )}
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Polls</h2>
        {userRole === 'planner' && (
          <Button onClick={() => {
            form.reset();
            setShowCreateDialog(true);
          }}>
            <Plus className="h-4 w-4 mr-2" /> Create Poll
          </Button>
        )}
      </div>
      
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-md text-red-700 flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          {error}
        </div>
      ) : polls.length === 0 ? (
        <Card className="text-center p-6">
          <CardContent className="pt-6">
            <HelpCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No polls yet</h3>
            <p className="text-muted-foreground">
              {userRole === 'planner' 
                ? "Create a poll to help make group decisions for your trip."
                : "The trip organizer hasn't created any polls yet."}
            </p>
            
            {userRole === 'planner' && (
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" /> Create First Poll
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Accordion type="single" collapsible className="w-full">
            {polls.map((poll) => (
              <AccordionItem key={poll.id} value={poll.id}>
                <AccordionTrigger className="hover:bg-muted/40 px-4 py-2 rounded-md">
                  <div className="flex-1 text-left">
                    <div className="font-medium">{poll.question}</div>
                    <div className="text-sm text-muted-foreground flex items-center space-x-4">
                      <span>
                        {poll.options?.reduce((sum, option) => sum + option.vote_count, 0)} vote
                        {(poll.options?.reduce((sum, option) => sum + option.vote_count, 0) || 0) !== 1 ? 's' : ''}
                      </span>
                      {poll.end_date && (
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          Ends {format(new Date(poll.end_date), 'MMM d, yyyy')}
                        </span>
                      )}
                      {poll.allow_multiple && (
                        <span className="flex items-center">
                          <Check className="h-3 w-3 mr-1" />
                          Multiple choices
                        </span>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-4">
                  <div className="space-y-4">
                    {poll.description && (
                      <div className="text-muted-foreground">{poll.description}</div>
                    )}
                    
                    {renderPollVoteOptions(poll)}
                    
                    {userRole === 'planner' && (
                      <div className="flex justify-end space-x-2 mt-4 pt-4 border-t">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setPollToDelete(poll);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash className="h-4 w-4 mr-2" /> Delete
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => openEditDialog(poll)}
                        >
                          <Edit className="h-4 w-4 mr-2" /> Edit
                        </Button>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
      
      {/* Create/Edit Poll Dialog */}
      <Dialog open={showCreateDialog || editingPoll !== null} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingPoll(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPoll ? 'Edit Poll' : 'Create New Poll'}</DialogTitle>
            <DialogDescription>
              {editingPoll 
                ? 'Update your poll details and options' 
                : 'Create a new poll for trip participants to vote on'}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(editingPoll ? handleEditPoll : handleCreatePoll)} className="space-y-6">
              <FormField
                control={form.control}
                name="question"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Question</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Where should we eat dinner on Saturday?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Add some context to your question..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>End Date (optional)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>No end date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={field.value || undefined}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        When voting will close
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="audience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Who Can Vote?</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select who can vote" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">All members</SelectItem>
                          <SelectItem value="going">Only attending members</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="allow_multiple"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox 
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Allow multiple choices</FormLabel>
                      <FormDescription>
                        Let participants select more than one option
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <div>
                <div className="flex items-center justify-between mb-4">
                  <FormLabel className="text-base">Poll Options</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addOptionField}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Option
                  </Button>
                </div>
                
                {form.getValues('options').map((_, index) => (
                  <div key={index} className="flex items-center mb-3">
                    <FormField
                      control={form.control}
                      name={`options.${index}.text`}
                      render={({ field }) => (
                        <FormItem className="flex-1 mr-2">
                          <FormControl>
                            <Input placeholder={`Option ${index + 1}`} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOptionField(index)}
                      disabled={form.getValues('options').length <= 2}
                      className="flex-shrink-0"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                {form.formState.errors.options?.message && (
                  <p className="text-sm font-medium text-destructive mt-2">
                    {form.formState.errors.options.message}
                  </p>
                )}
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowCreateDialog(false);
                    setEditingPoll(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingPoll ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>{editingPoll ? 'Update Poll' : 'Create Poll'}</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Poll</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this poll? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {pollToDelete && (
            <div className="py-4">
              <p className="font-medium">{pollToDelete.question}</p>
              {pollToDelete.description && (
                <p className="text-sm text-muted-foreground mt-1">{pollToDelete.description}</p>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDeleteDialog(false);
                setPollToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeletePoll}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>Delete Poll</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}