'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../components/ui/card';
import { Header } from '../../components/Header';
import { Loader2, AlertCircle } from 'lucide-react';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, UserCredential } from 'firebase/auth';
import app from '../../lib/firebase';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth/AuthProvider';
import { PhoneNumberInput } from '../../components/PhoneNumberInput';

// Add RecaptchaVerifier to the Window interface
declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier;
  }
}

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const router = useRouter();
  const { updateUserProfile, confirmOtp, startPhoneAuth } = useAuth();
  
  // Extract the phone number from URL query parameters if available
  React.useEffect(() => {
    // Check if running in browser (client-side)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const phoneParam = params.get('phone');
      if (phoneParam) {
        setPhoneNumber(phoneParam);
      }
    }
  }, []);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Use startPhoneAuth from AuthProvider for consistency
      const confirmationResult = await startPhoneAuth(phoneNumber);
      
      if (confirmationResult) {
        setConfirmation(confirmationResult);
        setStep('otp');
      } else {
        setError('Failed to send verification code. Please try again.');
      }
    } catch (err: any) {
      console.error('Error sending code:', err);
      setError(err.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!confirmation) {
        throw new Error("Verification session expired. Please try again.");
      }
      
      // Simply confirm the OTP with Firebase - no database validation needed
      // since we're explicitly creating a new user
      const user = await confirmOtp(confirmation, otp);
      
      if (!user) {
        throw new Error("Failed to verify code. Please try again.");
      }
      
      const uid = user.uid;
      
      try {
        // Update Firebase user profile with first and last name
        await updateUserProfile({
          firstName,
          lastName,
          user
        });
        
        // Call backend API to register user in our database
        await api.post('/users/register', {
          uid,
          phone_number: phoneNumber, // Already formatted with country code from PhoneNumberInput
          first_name: firstName,
          last_name: lastName,
        });
        
        // Successfully registered, redirect to dashboard
        router.push('/dashboard');
      } catch (apiErr: any) {
        console.error('API error:', apiErr);
        setError(apiErr.message || 'Registration failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Error verifying code:', err);
      setError(err.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header showAuthButtons={false} />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Create your TripSync account</CardTitle>
              <CardDescription>Enter your details to get started</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <p>{error}</p>
                </div>
              )}
              {step === 'form' ? (
                <form onSubmit={handleSendCode} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} required />
                  </div>
                  <PhoneNumberInput
                    value={phoneNumber}
                    onChange={setPhoneNumber}
                    required
                    helperText="We'll send a verification code to this number"
                  />
                  <div id="recaptcha-container"></div>
                  <Button type="submit" className="w-full" disabled={loading || !firstName || !lastName || !phoneNumber}>
                    {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>) : 'Send Verification Code'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp">Verification Code</Label>
                    <Input id="otp" value={otp} onChange={e => setOtp(e.target.value)} required placeholder="123456" />
                    <p className="text-xs text-muted-foreground">Enter the 6-digit code sent to {phoneNumber}</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || otp.length < 6}>
                    {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>) : 'Verify & Create Account'}
                  </Button>
                </form>
              )}
            </CardContent>
            <CardFooter className="flex flex-col items-center gap-2">
              <span className="text-xs text-muted-foreground">Already have an account? <a href="/login" className="underline">Sign in</a></span>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
}
