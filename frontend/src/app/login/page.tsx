'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../components/ui/card';
import { Header } from '../../components/Header';
import { Loader2, AlertCircle } from 'lucide-react';
import { ConfirmationResult } from 'firebase/auth';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth/AuthProvider';
import { PhoneNumberInput } from '../../components/PhoneNumberInput';

export default function LoginPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  
  const { startPhoneAuth, confirmOtp, refreshUserProfile } = useAuth();
  const router = useRouter();

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // First, check if the phone number exists in the database
      // BEFORE we begin any Firebase authentication
      const { exists } = await api.checkPhoneExists(phoneNumber);
      
      if (!exists) {
        // If phone number doesn't exist, redirect to registration page with the phone number
        console.log('User not found, redirecting to registration');
        router.push(`/register?phone=${encodeURIComponent(phoneNumber)}`);
        return;
      }
      
      // Only proceed with phone authentication if the user exists in our database
      console.log('User found, sending OTP');
      const confirmationResult = await startPhoneAuth(phoneNumber);
      
      if (confirmationResult) {
        setConfirmation(confirmationResult);
        setStep('otp');
      } else {
        setError('Failed to send verification code. Please try again.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
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

      // Verify the OTP with Firebase
      const user = await confirmOtp(confirmation, otp);
      
      if (!user) {
        setError('Invalid verification code. Please try again.');
        return;
      }
      
      // Explicitly refresh user profile to get first_name and last_name from database
      await refreshUserProfile();
      
      // We've already verified the user exists in our database during handlePhoneSubmit
      // So we can directly proceed to dashboard after successful OTP verification
      router.push('/dashboard');
      
    } catch (err: any) {
      console.error("OTP verification error:", err);
      setError(err.message || 'An error occurred during verification');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError(null);
    setLoading(true);
    
    try {
      const confirmationResult = await startPhoneAuth(phoneNumber);
      
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
                  <PhoneNumberInput
                    value={phoneNumber}
                    onChange={setPhoneNumber}
                    required
                    helperText="We'll send a verification code to this number"
                  />
                  
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