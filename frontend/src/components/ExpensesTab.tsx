'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { format } from 'date-fns';
import { useToast } from '../hooks/use-toast';
import {
  Wallet,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  CalendarIcon,
  Check,
  Loader2,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { TripMember, UserRole } from '../types';

interface ExpensesTabProps {
  tripId: string;
  currentUserId: string;
  userRole: UserRole;
  members: TripMember[];
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  currency: string;
  date: string;
  category?: string;
  description?: string;
  receipt_url?: string;
  creator_id: string;
  participants: ExpenseParticipant[];
}

interface ExpenseParticipant {
  id: string;
  expense_id: string;
  user_id: string;
  share_amount: number;
  paid: boolean;
}

interface Settlement {
  from_user_id: string;
  to_user_id: string;
  amount: number;
}

interface ExpenseSummary {
  total_expenses: number;
  users: UserBalance[];
  settlements: Settlement[];
  expense_count: number;
  currency: string;
}

interface UserBalance {
  user_id: string;
  paid: number;
  owed: number;
  net: number;
}

export function ExpensesTab({ tripId, currentUserId, userRole, members }: ExpensesTabProps) {
  // State for expenses and summary
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for expense form
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [currentExpense, setCurrentExpense] = useState<Expense | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // New expense form state
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCurrency, setExpenseCurrency] = useState('USD');
  const [expenseDate, setExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  // Removing receipt URL
  const [expenseSplitType, setExpenseSplitType] = useState('equal');
  const [expenseParticipants, setExpenseParticipants] = useState<{ user_id: string; share: number; paid: boolean }[]>([]);
  // New state for participant selection
  const [selectedParticipants, setSelectedParticipants] = useState<Record<string, boolean>>({});

  const { toast } = useToast();

  // Fetch expenses and summary on component mount
  useEffect(() => {
    fetchExpenses();
    fetchExpenseSummary();
  }, [tripId]);

  // Fetch expenses from API
  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const data = await api.getExpenses(tripId);
      setExpenses(data);
    } catch (err) {
      console.error('Error fetching expenses:', err);
      setError('Failed to load expenses. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch expense summary from API
  const fetchExpenseSummary = async () => {
    try {
      setLoading(true);
      const data = await api.getExpenseSummary(tripId);
      setSummary(data);
    } catch (err) {
      console.error('Error fetching expense summary:', err);
      setError('Failed to load expense summary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle adding a new expense
  const handleAddExpense = async () => {
    if (!expenseTitle.trim() || !expenseAmount || !expenseDate) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setFormSubmitting(true);

      // Get the selected participants
      const selectedUserIds = Object.keys(selectedParticipants)
        .filter(userId => selectedParticipants[userId]);

      // If no participants selected, notify user
      if (selectedUserIds.length === 0) {
        toast({
          title: 'No participants selected',
          description: 'Please select at least one participant to split the expense with',
          variant: 'destructive',
        });
        setFormSubmitting(false);
        return;
      }

      let participants = [];
      const amount = parseFloat(expenseAmount);

      // Handle different split types
      if (expenseSplitType === 'equal') {
        // Calculate equal shares
        const shareAmount = amount / selectedUserIds.length;
        
        participants = selectedUserIds.map(userId => ({
          user_id: userId,
          share: parseFloat(shareAmount.toFixed(2)),
          paid: userId === currentUserId // The current user is assumed to have paid
        }));
      } else {
        // Custom split - use the expenseParticipants state
        // Filter to only include selected participants
        participants = expenseParticipants.filter(p => selectedParticipants[p.user_id]);

        // Validate that shares add up to the total
        const totalShares = participants.reduce((sum, p) => sum + p.share, 0);
        if (Math.abs(totalShares - amount) > 0.01) {
          toast({
            title: 'Invalid shares',
            description: 'The sum of all shares must equal the total amount',
            variant: 'destructive',
          });
          setFormSubmitting(false);
          return;
        }
      }

      const expenseData = {
        title: expenseTitle,
        amount: amount,
        currency: expenseCurrency,
        date: expenseDate,
        category: expenseCategory || undefined,
        description: expenseDescription || undefined,
        participants
      };

      await api.addExpense(tripId, expenseData);

      // Reset form and refresh data
      resetForm();
      setShowAddDialog(false);
      
      toast({
        title: 'Expense added',
        description: 'The expense has been added successfully',
      });

      // Refresh the expenses list and summary
      await Promise.all([fetchExpenses(), fetchExpenseSummary()]);
    } catch (err) {
      console.error('Error adding expense:', err);
      toast({
        title: 'Error',
        description: 'Failed to add expense. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle editing an expense
  const handleEditExpense = async () => {
    if (!currentExpense || !expenseTitle.trim() || !expenseAmount || !expenseDate) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setFormSubmitting(true);

      // Get the selected participants
      const selectedUserIds = Object.keys(selectedParticipants)
        .filter(userId => selectedParticipants[userId]);

      // If no participants selected, notify user
      if (selectedUserIds.length === 0) {
        toast({
          title: 'No participants selected',
          description: 'Please select at least one participant to split the expense with',
          variant: 'destructive',
        });
        setFormSubmitting(false);
        return;
      }

      let participants = [];
      const amount = parseFloat(expenseAmount);

      // Handle different split types
      if (expenseSplitType === 'equal') {
        // Calculate equal shares
        const shareAmount = amount / selectedUserIds.length;
        
        participants = selectedUserIds.map(userId => ({
          user_id: userId,
          share: parseFloat(shareAmount.toFixed(2)),
          // Preserve paid status from original expense if it exists
          paid: userId === currentUserId || 
                (currentExpense.participants.find(p => p.user_id === userId)?.paid || false)
        }));
      } else {
        // Custom split - use the expenseParticipants state
        // Filter to only include selected participants
        participants = expenseParticipants.filter(p => selectedParticipants[p.user_id]);

        // Validate that shares add up to the total
        const totalShares = participants.reduce((sum, p) => sum + p.share, 0);
        if (Math.abs(totalShares - amount) > 0.01) {
          toast({
            title: 'Invalid shares',
            description: 'The sum of all shares must equal the total amount',
            variant: 'destructive',
          });
          setFormSubmitting(false);
          return;
        }
      }

      const expenseData = {
        title: expenseTitle,
        amount: amount,
        currency: expenseCurrency,
        date: expenseDate,
        category: expenseCategory || undefined,
        description: expenseDescription || undefined,
        participants
      };

      await api.updateExpense(tripId, currentExpense.id, expenseData);

      // Reset form and refresh data
      resetForm();
      setShowEditDialog(false);
      setCurrentExpense(null);
      
      toast({
        title: 'Expense updated',
        description: 'The expense has been updated successfully',
      });

      // Refresh the expenses list and summary
      await Promise.all([fetchExpenses(), fetchExpenseSummary()]);
    } catch (err) {
      console.error('Error updating expense:', err);
      toast({
        title: 'Error',
        description: 'Failed to update expense. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle deleting an expense
  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) {
      return;
    }

    try {
      setLoading(true);
      await api.deleteExpense(tripId, expenseId);
      
      toast({
        title: 'Expense deleted',
        description: 'The expense has been deleted successfully',
      });

      // Refresh the expenses list and summary
      await Promise.all([fetchExpenses(), fetchExpenseSummary()]);
    } catch (err) {
      console.error('Error deleting expense:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete expense. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle marking a participant as paid
  const handleMarkAsPaid = async (expenseId: string, userId: string) => {
    try {
      await api.markExpenseParticipantPaid(tripId, expenseId, userId);
      
      toast({
        title: 'Payment marked',
        description: 'The payment has been marked as completed',
      });

      // Refresh the expenses list and summary
      await Promise.all([fetchExpenses(), fetchExpenseSummary()]);
    } catch (err) {
      console.error('Error marking payment:', err);
      toast({
        title: 'Error',
        description: 'Failed to mark payment. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Open edit dialog with expense data
  const openEditDialog = (expense: Expense) => {
    setCurrentExpense(expense);
    setExpenseTitle(expense.title);
    setExpenseAmount(expense.amount.toString());
    setExpenseCurrency(expense.currency);
    setExpenseDate(expense.date);
    setExpenseCategory(expense.category || '');
    setExpenseDescription(expense.description || '');
    
    // Determine split type based on equal shares or custom
    const isEqual = isEqualSplit(expense.participants);
    setExpenseSplitType(isEqual ? 'equal' : 'custom');
    
    // Set participants for custom split
    setExpenseParticipants(
      expense.participants.map(p => ({
        user_id: p.user_id,
        share: p.share_amount,
        paid: p.paid
      }))
    );

    // Initialize selected participants based on existing expense
    const participantSelections: Record<string, boolean> = {};
    expense.participants.forEach(p => {
      participantSelections[p.user_id] = true;
    });
    setSelectedParticipants(participantSelections);
    
    setShowEditDialog(true);
  };

  // Check if expense is split equally among participants
  const isEqualSplit = (participants: ExpenseParticipant[]): boolean => {
    if (participants.length <= 1) return true;
    
    const firstShare = participants[0].share_amount;
    return participants.every(p => Math.abs(p.share_amount - firstShare) < 0.01);
  };

  // Format currency display
  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  // Reset the form fields
  const resetForm = () => {
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseCurrency('USD');
    setExpenseDate(format(new Date(), 'yyyy-MM-dd'));
    setExpenseCategory('');
    setExpenseDescription('');
    setExpenseSplitType('equal');
    setExpenseParticipants([]);
    
    // Reset participant selections
    const initialSelections: Record<string, boolean> = {};
    members.forEach(member => {
      // Default to selecting all going members
      initialSelections[member.user_id] = member.rsvp_status === 'going';
    });
    setSelectedParticipants(initialSelections);
  };

  // Handle participant selection change
  const handleParticipantSelectionChange = (userId: string, isSelected: boolean) => {
    setSelectedParticipants(prev => ({
      ...prev,
      [userId]: isSelected
    }));

    // Update participant shares when selection changes
    recalculateShares();
  };

  // Recalculate shares when selection or amount changes
  const recalculateShares = () => {
    if (expenseSplitType === 'equal' && expenseAmount) {
      const selectedUserIds = Object.keys(selectedParticipants)
        .filter(userId => selectedParticipants[userId]);

      if (selectedUserIds.length > 0) {
        const amount = parseFloat(expenseAmount);
        const equalShare = amount / selectedUserIds.length;
        
        // Update participant shares
        const updatedParticipants = members
          .filter(member => selectedParticipants[member.user_id])
          .map(member => ({
            user_id: member.user_id,
            share: parseFloat(equalShare.toFixed(2)),
            paid: member.user_id === currentUserId
          }));
        
        setExpenseParticipants(updatedParticipants);
      }
    }
  };

  // Update custom split amounts
  const updateParticipantShare = (userId: string, share: number) => {
    setExpenseParticipants(prev => 
      prev.map(p => p.user_id === userId ? { ...p, share } : p)
    );
  };

  // Find member by ID
  const findMember = (userId: string) => {
    return members.find(m => m.user_id === userId);
  };

  // Generate participant list
  const initializeParticipants = () => {
    const goingMembers = members.filter(m => m.rsvp_status === 'going');
    if (expenseAmount && goingMembers.length > 0) {
      const amount = parseFloat(expenseAmount);
      const equalShare = amount / goingMembers.length;
      
      setExpenseParticipants(
        goingMembers.map(member => ({
          user_id: member.user_id,
          share: parseFloat(equalShare.toFixed(2)),
          paid: member.user_id === currentUserId
        }))
      );
    }
  };

  // Effect to update participants when amount changes or split type changes
  useEffect(() => {
    if (expenseSplitType === 'equal') {
      initializeParticipants();
    }
  }, [expenseSplitType, expenseAmount]);

  // Handle changing to custom split
  const handleChangeSplitType = (value: string) => {
    setExpenseSplitType(value);
    
    if (value === 'equal') {
      initializeParticipants();
    } else if (value === 'custom' && expenseParticipants.length === 0) {
      // Initialize custom split with equal values as starting point
      initializeParticipants();
    }
  };

  // Effect to update participants when selection changes
  useEffect(() => {
    recalculateShares();
  }, [selectedParticipants, expenseAmount, expenseSplitType]);

  // Initialize participant selections
  useEffect(() => {
    const initialSelections: Record<string, boolean> = {};
    members.forEach(member => {
      // Default to selecting all going members
      initialSelections[member.user_id] = member.rsvp_status === 'going';
    });
    setSelectedParticipants(initialSelections);
  }, [members]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Expenses</h2>
        <Button 
          onClick={() => {
            resetForm();
            setShowAddDialog(true);
          }}
          className="flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Add Expense
        </Button>
      </div>
      
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="summary">
            <DollarSign className="w-4 h-4 mr-2" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="ledger">
            <Wallet className="w-4 h-4 mr-2" />
            All Expenses
          </TabsTrigger>
        </TabsList>
        
        {/* Summary Tab */}
        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>Expense Summary</CardTitle>
              <CardDescription>
                See who owes whom and the overall expense status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin h-8 w-8 text-primary" />
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-8">
                  <AlertCircle className="mr-2 h-5 w-5 text-destructive" />
                  <p className="text-destructive">{error}</p>
                </div>
              ) : !summary || !summary.users || summary.users.length === 0 ? (
                <div className="text-center py-12">
                  <Wallet className="h-16 w-16 mx-auto text-muted-foreground opacity-20" />
                  <h3 className="mt-4 text-lg font-medium">No expenses yet</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Add an expense to see the summary here.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Total expenses */}
                  <div className="text-center p-4 bg-primary/10 rounded-lg">
                    <h3 className="text-lg font-semibold text-muted-foreground">Total Trip Expenses</h3>
                    <p className="text-3xl font-bold text-primary">
                      {formatCurrency(summary.total_expenses, summary.currency)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {summary.expense_count} {summary.expense_count === 1 ? 'expense' : 'expenses'} recorded
                    </p>
                  </div>
                  
                  {/* Individual balances */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Individual Balances</h3>
                    <div className="space-y-4">
                      {summary.users.map(userBalance => {
                        const member = findMember(userBalance.user_id);
                        if (!member) return null;
                        
                        // Determine status color
                        let statusColor = 'bg-gray-100 text-gray-800';
                        if (userBalance.net > 0) {
                          statusColor = 'bg-green-100 text-green-800';
                        } else if (userBalance.net < 0) {
                          statusColor = 'bg-red-100 text-red-800';
                        }
                        
                        return (
                          <div key={userBalance.user_id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Avatar>
                                <AvatarFallback>
                                  {member.user?.first_name?.[0]}{member.user?.last_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{member.user?.first_name} {member.user?.last_name}</p>
                                <div className="flex space-x-4 text-sm text-muted-foreground">
                                  <span>Paid: {formatCurrency(userBalance.paid, summary.currency)}</span>
                                  <span>Owes: {formatCurrency(userBalance.owed, summary.currency)}</span>
                                </div>
                              </div>
                            </div>
                            <Badge className={`${statusColor} whitespace-nowrap`}>
                              {userBalance.net > 0 ? 'Gets back ' : userBalance.net < 0 ? 'Owes ' : 'Settled '}
                              {formatCurrency(Math.abs(userBalance.net), summary.currency)}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Settlements - who pays whom */}
                  {summary.settlements && summary.settlements.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Suggested Settlements</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>From</TableHead>
                            <TableHead>To</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summary.settlements.map((settlement, idx) => {
                            const fromMember = findMember(settlement.from_user_id);
                            const toMember = findMember(settlement.to_user_id);
                            
                            return (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">
                                  {fromMember ? `${fromMember.user?.first_name} ${fromMember.user?.last_name}` : 'Unknown'}
                                </TableCell>
                                <TableCell>
                                  {toMember ? `${toMember.user?.first_name} ${toMember.user?.last_name}` : 'Unknown'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(settlement.amount, summary.currency)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Ledger Tab */}
        <TabsContent value="ledger">
          <Card>
            <CardHeader>
              <CardTitle>Expense Ledger</CardTitle>
              <CardDescription>
                View all recorded expenses for this trip
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin h-8 w-8 text-primary" />
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-8">
                  <AlertCircle className="mr-2 h-5 w-5 text-destructive" />
                  <p className="text-destructive">{error}</p>
                </div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-12">
                  <Wallet className="h-16 w-16 mx-auto text-muted-foreground opacity-20" />
                  <h3 className="mt-4 text-lg font-medium">No expenses recorded yet</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Click the "Add Expense" button to record your first expense.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Paid By</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => {
                      const payer = findMember(expense.creator_id);
                      const canEdit = expense.creator_id === currentUserId || userRole === 'planner';
                      
                      return (
                        <TableRow key={expense.id}>
                          <TableCell>
                            {format(new Date(expense.date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="max-w-[200px] truncate">{expense.title}</div>
                          </TableCell>
                          <TableCell>
                            {payer ? `${payer.user?.first_name} ${payer.user?.last_name}` : 'Unknown'}
                          </TableCell>
                          <TableCell>
                            {expense.category || 'Uncategorized'}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(expense.amount, expense.currency)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(expense)}
                                disabled={!canEdit}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteExpense(expense.id)}
                                disabled={!canEdit}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Add Expense Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-2">
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>
              Record a new expense for this trip
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            <div>
              <Label htmlFor="title" className="text-xs">Title</Label>
              <Input
                id="title"
                value={expenseTitle}
                onChange={(e) => setExpenseTitle(e.target.value)}
                placeholder="Dinner, Hotel, etc."
                required
                className="h-9"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="amount" className="text-xs">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="h-9"
                />
              </div>
              
              <div>
                <Label htmlFor="currency" className="text-xs">Currency</Label>
                <Select
                  value={expenseCurrency}
                  onValueChange={setExpenseCurrency}
                >
                  <SelectTrigger id="currency" className="h-9">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="JPY">JPY</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                    <SelectItem value="AUD">AUD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="date" className="text-xs">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                  className="h-9"
                />
              </div>
              
              <div>
                <Label htmlFor="category" className="text-xs">Category (optional)</Label>
                <Select
                  value={expenseCategory}
                  onValueChange={setExpenseCategory}
                >
                  <SelectTrigger id="category" className="h-9">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="Food">Food & Dining</SelectItem>
                    <SelectItem value="Accommodation">Accommodation</SelectItem>
                    <SelectItem value="Transportation">Transportation</SelectItem>
                    <SelectItem value="Activities">Activities</SelectItem>
                    <SelectItem value="Shopping">Shopping</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="description" className="text-xs">Description (optional)</Label>
              <Textarea
                id="description"
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
                placeholder="Additional details..."
                className="h-16 resize-none"
              />
            </div>
            
            <div>
              <Label htmlFor="splitType" className="text-xs">Split Type</Label>
              <Select
                value={expenseSplitType}
                onValueChange={handleChangeSplitType}
              >
                <SelectTrigger id="splitType" className="h-9">
                  <SelectValue placeholder="How to split" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="equal">Equal Split</SelectItem>
                  <SelectItem value="custom">Custom Split</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {expenseSplitType === 'custom' && expenseParticipants.length > 0 && (
              <div className="pt-1 border-t">
                <Label className="text-xs font-medium">Custom Split Amounts</Label>
                <div className="max-h-32 overflow-y-auto mt-1">
                  {expenseParticipants.map((participant) => {
                    const member = findMember(participant.user_id);
                    
                    return (
                      <div key={participant.user_id} className="flex items-center justify-between py-1">
                        <span className="text-xs truncate max-w-[120px]">
                          {member ? `${member.user?.first_name} ${member.user?.last_name}` : 'Unknown'}
                        </span>
                        <div className="w-24">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={participant.share}
                            onChange={(e) => updateParticipantShare(
                              participant.user_id, 
                              parseFloat(e.target.value) || 0
                            )}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="flex justify-between pt-1 text-xs">
                  <span>Total:</span>
                  <span>
                    {formatCurrency(
                      expenseParticipants.reduce((sum, p) => sum + p.share, 0),
                      expenseCurrency
                    )}
                    {' / '}
                    {formatCurrency(parseFloat(expenseAmount) || 0, expenseCurrency)}
                  </span>
                </div>
              </div>
            )}

            <div className="border rounded-lg p-2 bg-muted/10">
              <div className="flex justify-between items-center mb-2">
                <Label className="text-xs font-medium">Split with</Label>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-6 text-xs py-0 px-2"
                  onClick={() => {
                    // Select all "going" members
                    const allGoing: Record<string, boolean> = {};
                    members.forEach(m => {
                      allGoing[m.user_id] = m.rsvp_status === 'going';
                    });
                    setSelectedParticipants(allGoing);
                  }}
                >
                  Reset to Going
                </Button>
              </div>
              
              <div className="max-h-48 overflow-y-auto grid grid-cols-1 gap-1">
                {members.map(member => {
                  const isCurrentUser = member.user_id === currentUserId;
                  return (
                    <div key={member.user_id} 
                      className={`flex items-center p-1.5 rounded-md border 
                        ${selectedParticipants[member.user_id] ? 'bg-primary/10 border-primary/30' : 'bg-background'} 
                        ${isCurrentUser ? 'ring-1 ring-primary/30' : ''}
                      `}>
                      <input
                        type="checkbox"
                        id={`participant-${member.user_id}`}
                        className="mr-2 h-3 w-3"
                        checked={selectedParticipants[member.user_id] || false}
                        onChange={(e) => handleParticipantSelectionChange(member.user_id, e.target.checked)}
                      />
                      <label htmlFor={`participant-${member.user_id}`} className="flex items-center flex-1 cursor-pointer text-xs">
                        <Avatar className="h-5 w-5 mr-1.5">
                          <AvatarFallback className="text-[10px]">
                            {member.user?.first_name?.[0]}{member.user?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className={isCurrentUser ? 'font-semibold truncate max-w-[80px]' : 'truncate max-w-[80px]'}>
                          {member.user?.first_name} {member.user?.last_name}
                          {isCurrentUser && <span className="ml-1 text-[10px] text-muted-foreground">(you)</span>}
                        </span>
                      </label>
                      {selectedParticipants[member.user_id] && expenseSplitType === 'equal' && (
                        <Badge variant="outline" className="ml-auto text-[10px] px-1 py-0 h-5">
                          {expenseAmount ? formatCurrency(parseFloat(expenseAmount) / 
                            Object.values(selectedParticipants).filter(Boolean).length, 
                            expenseCurrency) : '$0.00'}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          <DialogFooter className="mt-4 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                resetForm();
                setShowAddDialog(false);
              }}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddExpense}
              disabled={formSubmitting}
            >
              {formSubmitting ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Expense'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Expense Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-2">
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>
              Update expense information
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-title" className="text-xs">Title</Label>
              <Input
                id="edit-title"
                value={expenseTitle}
                onChange={(e) => setExpenseTitle(e.target.value)}
                placeholder="Dinner, Hotel, etc."
                required
                className="h-9"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-amount" className="text-xs">Amount</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="h-9"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-currency" className="text-xs">Currency</Label>
                <Select
                  value={expenseCurrency}
                  onValueChange={setExpenseCurrency}
                >
                  <SelectTrigger id="edit-currency" className="h-9">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="JPY">JPY</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                    <SelectItem value="AUD">AUD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-date" className="text-xs">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                  className="h-9"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-category" className="text-xs">Category (optional)</Label>
                <Select
                  value={expenseCategory}
                  onValueChange={setExpenseCategory}
                >
                  <SelectTrigger id="edit-category" className="h-9">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="Food">Food & Dining</SelectItem>
                    <SelectItem value="Accommodation">Accommodation</SelectItem>
                    <SelectItem value="Transportation">Transportation</SelectItem>
                    <SelectItem value="Activities">Activities</SelectItem>
                    <SelectItem value="Shopping">Shopping</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="edit-description" className="text-xs">Description (optional)</Label>
              <Textarea
                id="edit-description"
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
                placeholder="Additional details..."
                className="h-16 resize-none"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-splitType" className="text-xs">Split Type</Label>
              <Select
                value={expenseSplitType}
                onValueChange={handleChangeSplitType}
              >
                <SelectTrigger id="edit-splitType" className="h-9">
                  <SelectValue placeholder="How to split" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="equal">Equal Split</SelectItem>
                  <SelectItem value="custom">Custom Split</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {expenseSplitType === 'custom' && expenseParticipants.length > 0 && (
              <div className="pt-1 border-t">
                <Label className="text-xs font-medium">Custom Split Amounts</Label>
                <div className="max-h-32 overflow-y-auto mt-1">
                  {expenseParticipants.map((participant) => {
                    const member = findMember(participant.user_id);
                    
                    return (
                      <div key={participant.user_id} className="flex items-center justify-between py-1">
                        <span className="text-xs truncate max-w-[120px]">
                          {member ? `${member.user?.first_name} ${member.user?.last_name}` : 'Unknown'}
                        </span>
                        <div className="w-24">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={participant.share}
                            onChange={(e) => updateParticipantShare(
                              participant.user_id, 
                              parseFloat(e.target.value) || 0
                            )}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="flex justify-between pt-1 text-xs">
                  <span>Total:</span>
                  <span>
                    {formatCurrency(
                      expenseParticipants.reduce((sum, p) => sum + p.share, 0),
                      expenseCurrency
                    )}
                    {' / '}
                    {formatCurrency(parseFloat(expenseAmount) || 0, expenseCurrency)}
                  </span>
                </div>
              </div>
            )}
            
            <div className="border rounded-lg p-2 bg-muted/10">
              <div className="flex justify-between items-center mb-2">
                <Label className="text-xs font-medium">Split with</Label>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-6 text-xs py-0 px-2"
                  onClick={() => {
                    // Select all "going" members
                    const allGoing: Record<string, boolean> = {};
                    members.forEach(m => {
                      allGoing[m.user_id] = m.rsvp_status === 'going';
                    });
                    setSelectedParticipants(allGoing);
                  }}
                >
                  Reset to Going
                </Button>
              </div>
              
              <div className="max-h-48 overflow-y-auto grid grid-cols-1 gap-1">
                {members.map(member => {
                  const isCurrentUser = member.user_id === currentUserId;
                  return (
                    <div key={member.user_id} 
                      className={`flex items-center p-1.5 rounded-md border 
                        ${selectedParticipants[member.user_id] ? 'bg-primary/10 border-primary/30' : 'bg-background'} 
                        ${isCurrentUser ? 'ring-1 ring-primary/30' : ''}
                      `}>
                      <input
                        type="checkbox"
                        id={`edit-participant-${member.user_id}`}
                        className="mr-2 h-3 w-3"
                        checked={selectedParticipants[member.user_id] || false}
                        onChange={(e) => handleParticipantSelectionChange(member.user_id, e.target.checked)}
                      />
                      <label htmlFor={`edit-participant-${member.user_id}`} className="flex items-center flex-1 cursor-pointer text-xs">
                        <Avatar className="h-5 w-5 mr-1.5">
                          <AvatarFallback className="text-[10px]">
                            {member.user?.first_name?.[0]}{member.user?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className={isCurrentUser ? 'font-semibold truncate max-w-[80px]' : 'truncate max-w-[80px]'}>
                          {member.user?.first_name} {member.user?.last_name}
                          {isCurrentUser && <span className="ml-1 text-[10px] text-muted-foreground">(you)</span>}
                        </span>
                      </label>
                      {selectedParticipants[member.user_id] && expenseSplitType === 'equal' && (
                        <Badge variant="outline" className="ml-auto text-[10px] px-1 py-0 h-5">
                          {expenseAmount ? formatCurrency(parseFloat(expenseAmount) / 
                            Object.values(selectedParticipants).filter(Boolean).length, 
                            expenseCurrency) : '$0.00'}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          <DialogFooter className="mt-4 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                resetForm();
                setShowEditDialog(false);
                setCurrentExpense(null);
              }}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleEditExpense}
              disabled={formSubmitting}
            >
              {formSubmitting ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Updating...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}