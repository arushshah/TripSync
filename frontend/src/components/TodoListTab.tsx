'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { TodoItem, TripMember, User, UserRole } from '../types';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { 
  Trash2, Plus, Calendar, CheckSquare, AlertCircle, X, AlertTriangle,
  Calendar as CalendarIcon, User as UserIcon, CheckCircle2, Circle, 
  Edit, ArrowRight, Mail
} from 'lucide-react';
import { format, isAfter, isPast } from 'date-fns';

interface TodoListTabProps {
  tripId: string;
  currentUserId: string;
  userRole: UserRole;
  members: TripMember[];
}

export const TodoListTab = ({ tripId, currentUserId, userRole, members }: TodoListTabProps) => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [filteredTodos, setFilteredTodos] = useState<TodoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'mine'>('all');
  
  // Add dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTodoDescription, setNewTodoDescription] = useState('');
  const [newTodoAssignee, setNewTodoAssignee] = useState('');
  const [newTodoDueDate, setNewTodoDueDate] = useState('');
  
  // Edit dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [editTodoTitle, setEditTodoTitle] = useState('');
  const [editTodoDescription, setEditTodoDescription] = useState('');
  const [editTodoAssignee, setEditTodoAssignee] = useState('');
  const [editTodoDueDate, setEditTodoDueDate] = useState('');

  // Check if the user has edit permissions (planner or guest with edit rights)
  const canEdit = userRole === 'planner' || userRole === 'guest';

  useEffect(() => {
    fetchTodos();
  }, [tripId]);

  useEffect(() => {
    filterTodos();
  }, [todos, filter]);

  const fetchTodos = async () => {
    try {
      setIsLoading(true);
      const todoItems = await api.getTripTodos(tripId);
      
      // Transform the todo items to ensure fields are mapped correctly
      const transformedTodos = todoItems.map(todo => ({
        ...todo,
        assigned_to: todo.assigned_to_id, // Ensure assigned_to is set from assigned_to_id
        is_completed: todo.completed      // Map backend's 'completed' to frontend's 'is_completed'
      }));
      
      setTodos(transformedTodos);
    } catch (err) {
      setError('Failed to fetch todo items');
      console.error('Error fetching todos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filterTodos = () => {
    let filtered = [...todos];
    
    if (filter === 'completed') {
      filtered = filtered.filter(todo => todo.is_completed);
    } else if (filter === 'pending') {
      filtered = filtered.filter(todo => !todo.is_completed);
    } else if (filter === 'mine') {
      filtered = filtered.filter(todo => todo.assigned_to === currentUserId);
    }
    
    // Sort by completion status first, then by due date
    filtered.sort((a, b) => {
      // Sort completed tasks to the bottom
      if (a.is_completed !== b.is_completed) {
        return a.is_completed ? 1 : -1;
      }
      
      // Sort tasks with due dates before tasks without due dates
      if ((!a.due_date && b.due_date) || (a.due_date && b.due_date)) {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      
      return 0;
    });
    
    setFilteredTodos(filtered);
  };

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;
    
    try {
      setIsLoading(true);
      
      const newTodo = {
        title: newTodoTitle.trim(),
        description: newTodoDescription.trim() || undefined,
        assigned_to_id: newTodoAssignee === 'unassigned' ? undefined : newTodoAssignee || undefined,
        due_date: newTodoDueDate || undefined
      };
      
      const addedTodo = await api.createTripTodo(tripId, newTodo);
      
      // Ensure assigned_to is set properly
      const todoWithAssignment = {
        ...addedTodo,
        assigned_to: addedTodo.assigned_to_id
      };
      
      setTodos(prev => [...prev, todoWithAssignment]);
      
      // Reset form
      setNewTodoTitle('');
      setNewTodoDescription('');
      setNewTodoAssignee('');
      setNewTodoDueDate('');
      setIsAddDialogOpen(false);
    } catch (err) {
      setError('Failed to add todo item');
      console.error('Error adding todo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const quickAddTodo = async () => {
    if (!newTodoTitle.trim()) return;
    
    try {
      setIsLoading(true);
      
      const newTodo = {
        title: newTodoTitle.trim(),
      };
      
      const addedTodo = await api.createTripTodo(tripId, newTodo);
      setTodos(prev => [...prev, addedTodo]);
      
      // Reset form
      setNewTodoTitle('');
    } catch (err) {
      setError('Failed to add todo item');
      console.error('Error adding todo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTodoCompletion = async (todoId: string, currentStatus: boolean) => {
    try {
      setIsLoading(true);
      
      // Send the right field name to the backend (completed, not is_completed)
      const updatedTodo = await api.updateTripTodo(tripId, todoId, {
        completed: !currentStatus
      });
      
      // Update local state using frontend field name (is_completed)
      setTodos(prev => prev.map(todo => 
        todo.id === todoId ? { ...todo, is_completed: !currentStatus } : todo
      ));
    } catch (err) {
      setError('Failed to update todo status');
      console.error('Error updating todo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTodo = async (todoId: string) => {
    try {
      setIsLoading(true);
      
      await api.deleteTripTodo(tripId, todoId);
      setTodos(prev => prev.filter(todo => todo.id !== todoId));
    } catch (err) {
      setError('Failed to delete todo item');
      console.error('Error deleting todo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getUserNameById = (userId: string | undefined): string => {
    if (!userId) return '';
    
    const member = members.find(m => m.user_id === userId);
    if (!member || !member.user) return 'Unknown User';
    
    return `${member.user.first_name} ${member.user.last_name}`;
  };

  const isDueSoon = (dueDate: string | undefined): boolean => {
    if (!dueDate) return false;
    
    const today = new Date();
    const due = new Date(dueDate);
    
    // Task is due in the next 2 days
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(today.getDate() + 2);
    
    return isPast(due) || (isAfter(due, today) && isAfter(twoDaysFromNow, due));
  };

  // Handle opening the edit dialog for a specific todo
  const handleEditTodo = (todo: TodoItem) => {
    setEditingTodo(todo);
    setEditTodoTitle(todo.title);
    setEditTodoDescription(todo.description || '');
    setEditTodoAssignee(todo.assigned_to || 'unassigned'); // Use 'unassigned' instead of empty string
    setEditTodoDueDate(todo.due_date ? todo.due_date.split('T')[0] : '');
    setIsEditDialogOpen(true);
  };

  // Save edited todo
  const saveEditedTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTodo || !editTodoTitle.trim()) return;

    try {
      setIsLoading(true);
      
      const updatedTodo = {
        title: editTodoTitle.trim(),
        description: editTodoDescription.trim() || undefined,
        assigned_to_id: editTodoAssignee === 'unassigned' ? undefined : editTodoAssignee,
        due_date: editTodoDueDate || undefined
      };
      
      const result = await api.updateTripTodo(tripId, editingTodo.id, updatedTodo);
      
      setTodos(prev => prev.map(todo => 
        todo.id === editingTodo.id 
          ? { 
              ...todo, 
              title: editTodoTitle,
              description: editTodoDescription || undefined,
              assigned_to_id: editTodoAssignee === 'unassigned' ? undefined : editTodoAssignee,
              assigned_to: editTodoAssignee === 'unassigned' ? undefined : editTodoAssignee,
              due_date: editTodoDueDate || undefined
            } 
          : todo
      ));
      
      setIsEditDialogOpen(false);
      setEditingTodo(null);
    } catch (err) {
      setError('Failed to update todo item');
      console.error('Error updating todo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate task counts for each filter
  const getTaskCounts = () => {
    const totalCount = todos.length;
    const pendingCount = todos.filter(todo => !todo.is_completed).length;
    const completedCount = todos.filter(todo => todo.is_completed).length;
    const assignedToMeCount = todos.filter(todo => todo.assigned_to === currentUserId).length;
    
    return { totalCount, pendingCount, completedCount, assignedToMeCount };
  };

  if (isLoading && todos.length === 0) {
    return <div className="flex items-center justify-center h-40">Loading to-do items...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Trip To-Do List</h2>
        <div className="flex gap-2">
          {canEdit && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Task</DialogTitle>
                </DialogHeader>
                <form onSubmit={addTodo} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="title">Task Title *</Label>
                    <Input 
                      id="title"
                      placeholder="Enter task title"
                      value={newTodoTitle}
                      onChange={(e) => setNewTodoTitle(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea 
                      id="description"
                      placeholder="Add details about this task"
                      value={newTodoDescription}
                      onChange={(e) => setNewTodoDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="assignee">Assign To (optional)</Label>
                    <Select
                      value={newTodoAssignee}
                      onValueChange={setNewTodoAssignee}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a person" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {members.map(member => (
                          <SelectItem key={member.user_id} value={member.user_id}>
                            {member.user?.first_name} {member.user?.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date (optional)</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={newTodoDueDate}
                      onChange={(e) => setNewTodoDueDate(e.target.value)}
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
                    <Button type="submit" disabled={!newTodoTitle.trim()}>
                      Add Task
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Filter tabs with counts */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full">
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="all" className="flex items-center justify-center">
            All
            <span className="ml-1.5 flex items-center justify-center min-w-5 h-5 rounded-full bg-muted px-1.5 text-xs font-medium">
              {getTaskCounts().totalCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center justify-center">
            Pending
            <span className="ml-1.5 flex items-center justify-center min-w-5 h-5 rounded-full bg-muted px-1.5 text-xs font-medium">
              {getTaskCounts().pendingCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center justify-center">
            Completed
            <span className="ml-1.5 flex items-center justify-center min-w-5 h-5 rounded-full bg-muted px-1.5 text-xs font-medium">
              {getTaskCounts().completedCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="mine" className="flex items-center justify-center">
            Assigned to Me
            <span className="ml-1.5 flex items-center justify-center min-w-5 h-5 rounded-full bg-muted px-1.5 text-xs font-medium">
              {getTaskCounts().assignedToMeCount}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Quick add task input */}
      {canEdit && (
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Add a quick task..."
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTodoTitle.trim()) {
                e.preventDefault();
                quickAddTodo();
              }
            }}
          />
          <Button 
            onClick={quickAddTodo} 
            disabled={!newTodoTitle.trim()}
          >
            Add
          </Button>
        </div>
      )}

      {/* Todo list */}
      <Card>
        <CardContent className="p-4">
          {filteredTodos.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              {filter === 'all' ? (
                <>
                  <CheckSquare className="mx-auto h-10 w-10 mb-2 opacity-30" />
                  <p>No tasks yet. {canEdit && "Add your first task to get started!"}</p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="mx-auto h-10 w-10 mb-2 opacity-30" />
                  <p>No {filter === 'completed' ? 'completed' : filter === 'pending' ? 'pending' : 'assigned'} tasks</p>
                </>
              )}
            </div>
          ) : (
            <ul className="divide-y">
              {filteredTodos.map(todo => (
                <li 
                  key={todo.id} 
                  className={`py-3 flex items-start gap-3 group ${todo.is_completed ? 'opacity-60' : ''}`}
                >
                  <div className="flex-shrink-0 pt-1">
                    <Checkbox 
                      checked={todo.is_completed} 
                      onCheckedChange={() => canEdit && toggleTodoCompletion(todo.id, todo.is_completed)}
                      disabled={!canEdit}
                    />
                  </div>
                  
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => canEdit && handleEditTodo(todo)}
                  >
                    <p className={`font-medium ${todo.is_completed ? 'line-through' : ''}`}>
                      {todo.title}
                    </p>
                    
                    {todo.description && (
                      <p className="text-sm text-gray-500 mt-1">{todo.description}</p>
                    )}
                    
                    <div className="flex flex-wrap gap-2 mt-2">
                      {todo.assigned_to && (
                        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                          <UserIcon className="h-3 w-3 mr-1" />
                          <span>{getUserNameById(todo.assigned_to)}</span>
                        </div>
                      )}
                      
                      {todo.due_date && (
                        <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          isPast(new Date(todo.due_date)) && !todo.is_completed 
                            ? 'bg-red-100 text-red-800 border-red-200' 
                            : isDueSoon(todo.due_date) && !todo.is_completed
                              ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                              : 'text-gray-700'
                        }`}>
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          <span>{format(new Date(todo.due_date), 'MMM d, yyyy')}</span>
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
                  
                  {canEdit && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTodo(todo.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-500" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Edit Todo Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEditedTodo} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Task Title *</Label>
              <Input 
                id="edit-title"
                placeholder="Enter task title"
                value={editTodoTitle}
                onChange={(e) => setEditTodoTitle(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Textarea 
                id="edit-description"
                placeholder="Add details about this task"
                value={editTodoDescription}
                onChange={(e) => setEditTodoDescription(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-assignee">Assign To</Label>
              <Select
                value={editTodoAssignee}
                onValueChange={setEditTodoAssignee}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map(member => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.user?.first_name} {member.user?.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-dueDate">Due Date</Label>
              <Input
                id="edit-dueDate"
                type="date"
                value={editTodoDueDate}
                onChange={(e) => setEditTodoDueDate(e.target.value)}
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
              <Button type="submit" disabled={!editTodoTitle.trim()}>
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