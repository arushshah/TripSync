'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Header } from '@/components/Header';
import api from '@/lib/api';

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Get user profile data when component mounts
  useEffect(() => {
    if (loading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }
    
    // Fetch user profile
    const fetchUserProfile = async () => {
      try {
        const response = await api.getUserProfile();
        if (response) {
          setFirstName(response.first_name || '');
          setLastName(response.last_name || '');
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        setError('Failed to load profile information');
      }
    };
    
    fetchUserProfile();
  }, [user, loading, router]);
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    
    try {
      await api.updateUserProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim()
      });
      setSuccess('Profile updated successfully!');
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const getUserInitials = () => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName[0].toUpperCase();
    }
    if (user?.displayName) {
      const nameParts = user.displayName.split(' ');
      if (nameParts.length > 1) {
        return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
      }
      return nameParts[0][0].toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return '?';
  };
  
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="container flex items-center justify-center flex-1">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }
  
  if (!user) {
    // This should not happen as we redirect in the useEffect
    return null;
  }
  
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-1 p-4 md:p-6">
        <div className="container max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Your Profile</h1>
          
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="mb-6 bg-green-50 border-green-200 text-green-800">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <Avatar className="h-20 w-20 text-lg">
                  {user.photoURL ? (
                    <AvatarImage src={user.photoURL} alt={user.displayName || user.email || 'User'} />
                  ) : (
                    <AvatarFallback>{getUserInitials()}</AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <CardTitle className="text-xl">{user.displayName || user.email}</CardTitle>
                  <CardDescription>{user.email}</CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter your first name"
                    required
                    autoComplete="given-name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter your last name"
                    required
                    autoComplete="family-name"
                  />
                </div>
              </CardContent>
              
              <CardFooter>
                <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}