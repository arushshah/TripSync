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
  const { updateUserProfile } = useAuth();
  
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

  // Format phone number to E.164
  const formatPhoneNumber = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (!digits.startsWith('+')) {
      return `+1${digits}`;
    }
    return digits;
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const auth = getAuth(app);
      
      // Reset recaptchaVerifier if it exists
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
      }
      
      // Create new recaptchaVerifier
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
      
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
      setConfirmation(confirmationResult);
      setStep('otp');
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
      
      const result: UserCredential = await confirmation.confirm(otp);
      const user = result.user;
      const uid = user.uid;
      
      try {
        // Update Firebase user profile with first and last name - pass the user object directly
        await updateUserProfile({
          firstName,
          lastName,
          user // Pass the user object from the authentication result
        });
        
        // Call backend API to register user using our API client
        await api.post('/users/register', {
          uid,
          phone_number: formatPhoneNumber(phoneNumber),
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
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Input id="phoneNumber" type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} required placeholder="+1 (555) 123-4567" />
                    <p className="text-xs text-muted-foreground">Enter your phone number with country code</p>
                  </div>
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
