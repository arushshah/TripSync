'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { ItineraryItem, Trip, TripMember, UserRole } from '../types';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  Trash2, Plus, Calendar, AlertCircle, X, Edit, ChevronDown, ChevronUp, Clock, MapPin
} from 'lucide-react';
import { GripVertical } from 'lucide-react';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { formatTime } from '../utils/dateHelpers';

interface ItineraryTabProps {
  trip: Trip;
  tripId: string;
  currentUserId: string;
  userRole: UserRole;
  members: TripMember[];
}

export const ItineraryTab = ({ trip, tripId, currentUserId, userRole }: ItineraryTabProps) => {
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<string[]>([]);
  
  // Add dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addDate, setAddDate] = useState<string>('');
  const [addTitle, setAddTitle] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addStartTime, setAddStartTime] = useState('');
  const [addEndTime, setAddEndTime] = useState('');
  const [addLocation, setAddLocation] = useState('');
  
  // Edit dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editLocation, setEditLocation] = useState('');

  // Check if the user has edit permissions (any trip member can edit the itinerary)
  const canEdit = userRole === 'planner' || userRole === 'guest';

  // Calculate trip days as an array of date strings
  const tripDays = React.useMemo(() => {
    if (!trip.start_date || !trip.end_date) return [];
    
    const startDate = parseISO(trip.start_date);
    const endDate = parseISO(trip.end_date);
    const dayCount = differenceInDays(endDate, startDate) + 1;
    
    return Array.from({ length: dayCount }, (_, i) => {
      // Create date with time set to noon to avoid timezone issues
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      date.setHours(12, 0, 0, 0);
      return date.toISOString().split('T')[0];
    });
  }, [trip]);

  // Group itinerary items by date
  const itemsByDay = React.useMemo(() => {
    const grouped: { [key: string]: ItineraryItem[] } = {};
    
    tripDays.forEach(day => {
      grouped[day] = [];
    });
    
    itineraryItems.forEach(item => {
      const itemDate = item.date.split('T')[0];
      if (grouped[itemDate]) {
        grouped[itemDate].push(item);
      }
    });
    
    // Sort items within each day by start_time
    Object.keys(grouped).forEach(day => {
      grouped[day].sort((a, b) => {
        if (!a.start_time) return 1;
        if (!b.start_time) return -1;
        return a.start_time.localeCompare(b.start_time);
      });
    });
    
    return grouped;
  }, [itineraryItems, tripDays]);

  useEffect(() => {
    fetchItineraryItems();
  }, [tripId]);

  // Default the first day to be expanded
  useEffect(() => {
    if (tripDays.length > 0 && expandedDays.length === 0) {
      setExpandedDays([tripDays[0]]);
    }
  }, [tripDays]);

  const fetchItineraryItems = async () => {
    try {
      setIsLoading(true);
      const items = await api.getItinerary(tripId);
      setItineraryItems(items);
    } catch (err) {
      setError('Failed to fetch itinerary items');
      console.error('Error fetching itinerary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const addItineraryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTitle.trim() || !addDate) return;
    
    try {
      setIsLoading(true);
      
      const newItem = {
        title: addTitle.trim(),
        description: addDescription.trim() || undefined,
        date: addDate,
        start_time: addStartTime || undefined,
        end_time: addEndTime || undefined,
        location: addLocation.trim() || undefined,
      };
      
      const addedItem = await api.createItineraryItem(tripId, newItem);
      setItineraryItems(prev => [...prev, addedItem]);
      
      // Reset form
      setAddTitle('');
      setAddDescription('');
      setAddStartTime('');
      setAddEndTime('');
      setAddLocation('');
      setIsAddDialogOpen(false);
      
      // Make sure the day is expanded
      if (!expandedDays.includes(addDate)) {
        setExpandedDays(prev => [...prev, addDate]);
      }
    } catch (err) {
      setError('Failed to add itinerary item');
      console.error('Error adding itinerary item:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteItineraryItem = async (itemId: string) => {
    try {
      setIsLoading(true);
      
      await api.deleteItineraryItem(tripId, itemId);
      setItineraryItems(prev => prev.filter(item => item.id !== itemId));
    } catch (err) {
      setError('Failed to delete itinerary item');
      console.error('Error deleting itinerary item:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle opening the edit dialog for a specific itinerary item
  const handleEditItem = (item: ItineraryItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditDescription(item.description || '');
    setEditDate(item.date.split('T')[0]);
    setEditStartTime(item.start_time?.slice(0, 5) || ''); // HH:MM format
    setEditEndTime(item.end_time?.slice(0, 5) || '');
    setEditLocation(item.location || '');
    setIsEditDialogOpen(true);
  };

  // Save edited itinerary item
  const saveEditedItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editTitle.trim() || !editDate) return;

    try {
      setIsLoading(true);
      
      const updatedItem = {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        date: editDate,
        start_time: editStartTime || undefined,
        end_time: editEndTime || undefined,
        location: editLocation.trim() || undefined,
      };
      
      const result = await api.updateItineraryItem(tripId, editingItem.id, updatedItem);
      
      setItineraryItems(prev => prev.map(item => 
        item.id === editingItem.id 
          ? { 
              ...item, 
              title: editTitle,
              description: editDescription || undefined,
              date: editDate,
              start_time: editStartTime || undefined,
              end_time: editEndTime || undefined,
              location: editLocation || undefined,
            } 
          : item
      ));
      
      setIsEditDialogOpen(false);
      setEditingItem(null);
      
      // If the date changed, make sure that day is expanded
      if (editDate !== editingItem.date.split('T')[0] && !expandedDays.includes(editDate)) {
        setExpandedDays(prev => [...prev, editDate]);
      }
    } catch (err) {
      setError('Failed to update itinerary item');
      console.error('Error updating itinerary item:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccordionChange = (value: string[]) => {
    setExpandedDays(value);
  };

  const handleAddToDay = (date: string) => {
    setAddDate(date);
    setIsAddDialogOpen(true);
  };

  // Handle drag and drop
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    
    // Dropped outside the list or no change
    if (!destination || 
        (destination.droppableId === source.droppableId && 
         destination.index === source.index)) {
      return;
    }
    
    const sourceDate = source.droppableId;
    const destDate = destination.droppableId;
    const itemToMove = itineraryItems.find(item => item.id === draggableId);
    
    if (!itemToMove) return;
    
    try {
      setIsLoading(true);
      
      // Make a copy of the current state
      const newItems = [...itineraryItems];
      
      // First remove the item from its original position
      const sourceItems = [...itemsByDay[sourceDate]];
      sourceItems.splice(source.index, 1);
      
      // Then insert it at the new position
      const destItems = [...(sourceDate === destDate ? sourceItems : itemsByDay[destDate])];
      destItems.splice(destination.index, 0, itemToMove);
      
      // Update the item's date if it changed
      if (sourceDate !== destDate) {
        const updatedItem = {
          ...itemToMove,
          date: destDate,
        };
        
        // Update the backend
        await api.updateItineraryItem(tripId, itemToMove.id, {
          date: destDate
        });
        
        // Update local state
        newItems.forEach(item => {
          if (item.id === itemToMove.id) {
            item.date = destDate;
          }
        });
      }
      
      // Reorder within the same day
      if (sourceDate === destDate && source.index !== destination.index) {
        // Note: We don't have an explicit order field, but for a real implementation,
        // we would update the order field on all affected items here
        
        // For this prototype, we're just reordering the array
        setItineraryItems(newItems);
      } else {
        setItineraryItems(newItems);
      }
    } catch (err) {
      setError('Failed to reorder itinerary items');
      console.error('Error reordering items:', err);
      // Refresh the list to ensure UI is in sync with backend
      fetchItineraryItems();
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateHeader = (dateStr: string) => {
    const date = parseISO(dateStr);
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  if (isLoading && itineraryItems.length === 0) {
    return <div className="flex items-center justify-center h-40">Loading itinerary...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Trip Itinerary</h2>
        {canEdit && (
          <div className="flex gap-2">
            <Button 
              size="sm"
              onClick={() => api.generateItinerary(tripId).then(() => fetchItineraryItems())}
            >
              Auto-Generate Skeleton
            </Button>
          </div>
        )}
      </div>
      
      {tripDays.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <Calendar className="mx-auto h-10 w-10 mb-2 opacity-30" />
          <p>Trip dates not set. Please set trip dates to create an itinerary.</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Accordion 
            type="multiple" 
            value={expandedDays}
            onValueChange={handleAccordionChange}
            className="space-y-2"
          >
            {tripDays.map((day, dayIndex) => (
              <AccordionItem 
                value={day} 
                key={day}
                className="border rounded-lg overflow-hidden"
              >
                <AccordionTrigger className="px-4 py-3 hover:bg-muted/50">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center">
                      <span className="font-medium">Day {dayIndex + 1}: {formatDateHeader(day)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {itemsByDay[day]?.length || 0} {itemsByDay[day]?.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="px-4 pt-2 pb-4">
                    <Droppable droppableId={day} type="itineraryItem">
                      {(provided) => (
                        <div 
                          ref={provided.innerRef} 
                          {...provided.droppableProps}
                          className="space-y-2"
                        >
                          {itemsByDay[day]?.length === 0 ? (
                            <div className="text-center py-6 text-gray-500">
                              <p>No activities planned for this day yet.</p>
                            </div>
                          ) : (
                            itemsByDay[day]?.map((item, index) => (
                              <Draggable 
                                key={item.id} 
                                draggableId={item.id} 
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`border rounded-md p-3 bg-card ${snapshot.isDragging ? 'shadow-lg' : ''} group`}
                                  >
                                    <div className="flex items-start">
                                      <div 
                                        {...provided.dragHandleProps} 
                                        className="mt-1 mr-2 p-0.5 rounded hover:bg-muted cursor-move"
                                      >
                                        <GripVertical className="h-4 w-4 text-gray-400" />
                                      </div>
                                      
                                      <div className="flex-1 min-w-0">
                                        <div 
                                          className="cursor-pointer"
                                          onClick={() => canEdit && handleEditItem(item)}
                                        >
                                          <h4 className="font-medium text-base">{item.title}</h4>
                                          
                                          {item.description && (
                                            <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                                          )}
                                          
                                          <div className="flex flex-wrap gap-2 mt-2">
                                            {(item.start_time || item.end_time) && (
                                              <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                                                <Clock className="h-3 w-3 mr-1" />
                                                <span>
                                                  {item.start_time && formatTime(item.start_time)}
                                                  {item.start_time && item.end_time && ' - '}
                                                  {item.end_time && formatTime(item.end_time)}
                                                </span>
                                              </div>
                                            )}
                                            
                                            {item.location && (
                                              <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                                                <MapPin className="h-3 w-3 mr-1" />
                                                <span>{item.location}</span>
                                              </div>
                                            )}
                                            
                                            {canEdit && (
                                              <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Edit className="h-3 w-3 mr-1" />
                                                <span>Click to edit</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {canEdit && (
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          onClick={() => deleteItineraryItem(item.id)}
                                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-500" />
                                          <span className="sr-only">Delete</span>
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))
                          )}
                          {provided.placeholder}
                          
                          {canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-3"
                              onClick={() => handleAddToDay(day)}
                            >
                              <Plus className="h-4 w-4 mr-1" /> 
                              Add Activity
                            </Button>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </DragDropContext>
      )}

      {/* Add Itinerary Item Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Itinerary Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={addItineraryItem} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Select
                value={addDate}
                onValueChange={setAddDate}
              >
                <SelectTrigger id="date" className="w-full">
                  <SelectValue placeholder="Select a date" />
                </SelectTrigger>
                <SelectContent>
                  {tripDays.map(day => (
                    <SelectItem key={day} value={day}>
                      {formatDateHeader(day)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input 
                id="title"
                placeholder="Enter activity title"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea 
                id="description"
                placeholder="Add details about this activity"
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time (optional)</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={addStartTime}
                  onChange={(e) => setAddStartTime(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="end-time">End Time (optional)</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={addEndTime}
                  onChange={(e) => setAddEndTime(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="location">Location (optional)</Label>
              <Input
                id="location"
                placeholder="Enter location"
                value={addLocation}
                onChange={(e) => setAddLocation(e.target.value)}
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={!addTitle.trim() || !addDate}
              >
                Add Activity
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Itinerary Item Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Itinerary Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEditedItem} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="edit-date">Date *</Label>
              <Select
                value={editDate}
                onValueChange={setEditDate}
              >
                <SelectTrigger id="edit-date" className="w-full">
                  <SelectValue placeholder="Select a date" />
                </SelectTrigger>
                <SelectContent>
                  {tripDays.map(day => (
                    <SelectItem key={day} value={day}>
                      {formatDateHeader(day)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input 
                id="edit-title"
                placeholder="Enter activity title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Textarea 
                id="edit-description"
                placeholder="Add details about this activity"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-start-time">Start Time (optional)</Label>
                <Input
                  id="edit-start-time"
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-end-time">End Time (optional)</Label>
                <Input
                  id="edit-end-time"
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-location">Location (optional)</Label>
              <Input
                id="edit-location"
                placeholder="Enter location"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={!editTitle.trim() || !editDate}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {error && ( 
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="ml-auto" 
            onClick={() => setError(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

function CustomSelect({ id, value, onChange, required, className, children }: any) {
  return (
    <select 
      id={id} 
      value={value} 
      onChange={onChange} 
      required={required} 
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </select>
  );
}