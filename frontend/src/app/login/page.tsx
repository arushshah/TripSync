'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';
import { ConfirmationResult } from 'firebase/auth';
import { Header } from '../../components/Header';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

export default function LoginPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  
  const { startPhoneAuth, confirmOtp } = useAuth();
  const router = useRouter();

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Format phone number to E.164 format
      const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
      
      // Check if the phone number exists in the database
      const { exists } = await api.checkPhoneExists(formattedPhoneNumber);
      
      if (!exists) {
        // If phone number doesn't exist, redirect to registration page
        // Add phone number as a query parameter to prefill the form
        router.push(`/register?phone=${encodeURIComponent(formattedPhoneNumber)}`);
        return;
      }
      
      // Proceed with phone authentication since the user exists
      const confirmationResult = await startPhoneAuth(formattedPhoneNumber);
      
      if (confirmationResult) {
        setConfirmation(confirmationResult);
        setStep('otp');
      } else {
        setError('Failed to send verification code. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!confirmation) {
        setError('Authentication session expired. Please try again.');
        setStep('phone');
        return;
      }

      const user = await confirmOtp(confirmation, otp);
      
      if (user) {
        router.push('/dashboard');
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during verification');
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Ensure it has the + prefix if not already present
    if (!digits.startsWith('+')) {
      // Assuming US number if no country code provided
      return `+1${digits}`;
    }
    
    return digits;
  };

  const handleResendOtp = async () => {
    setError(null);
    setLoading(true);
    
    try {
      const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
      const confirmationResult = await startPhoneAuth(formattedPhoneNumber);
      
      if (confirmationResult) {
        setConfirmation(confirmationResult);
        setError('Verification code resent!');
      } else {
        setError('Failed to resend verification code. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while resending the code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header showAuthButtons={false} />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          <Card className="mx-auto w-full max-w-md">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl font-bold">Sign in to TripSync</CardTitle>
              <CardDescription>
                Enter your phone number to receive a verification code
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <p>{error}</p>
                </div>
              )}
              
              {step === 'phone' ? (
                <form onSubmit={handlePhoneSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter your phone number with country code
                    </p>
                  </div>
                  
                  {/* Invisible recaptcha container */}
                  <div id="recaptcha-container"></div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading || !phoneNumber}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Verification Code'
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleOtpSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp">Verification Code</Label>
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the 6-digit code sent to {phoneNumber}
                    </p>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading || otp.length < 6}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify & Sign In'
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
            
            <CardFooter className="flex flex-col space-y-4">
              {step === 'otp' && (
                <div className="flex w-full justify-between">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setStep('phone')}
                    className="px-0"
                  >
                    Change Phone Number
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="px-0"
                  >
                    Resend Code
                  </Button>
                </div>
              )}
              
              {step === 'phone' && (
                <div className="text-center w-full">
                  <span className="text-sm text-muted-foreground">
                    Don't have an account? <Button variant="link" className="p-0 h-auto font-normal" onClick={() => router.push('/register')}>Create one now</Button>
                  </span>
                </div>
              )}
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
}