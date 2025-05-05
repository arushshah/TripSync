'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPhoneNumber, 
  RecaptchaVerifier, 
  ConfirmationResult, 
  User,
  signOut,
  updateProfile
} from 'firebase/auth';
import { auth } from '../firebase';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  startPhoneAuth: (phoneNumber: string) => Promise<ConfirmationResult | null>;
  confirmOtp: (confirmationResult: ConfirmationResult, otp: string) => Promise<User | null>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  updateUserProfile: (userData: { firstName: string; lastName: string; user?: User }) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const startPhoneAuth = async (phoneNumber: string) => {
    try {
      if (typeof window !== 'undefined') {
        const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
        });
        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
        return confirmationResult;
      }
      return null;
    } catch (error) {
      console.error("Error starting phone auth:", error);
      return null;
    }
  };

  const confirmOtp = async (confirmationResult: ConfirmationResult, otp: string) => {
    try {
      const userCredential = await confirmationResult.confirm(otp);
      return userCredential.user;
    } catch (error) {
      console.error("Error confirming OTP:", error);
      return null;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const getIdToken = async () => {
    try {
      if (!user) return null;
      return await user.getIdToken();
    } catch (error) {
      console.error("Error getting ID token:", error);
      return null;
    }
  };

  const updateUserProfile = async (userData: { firstName: string; lastName: string; user?: User }) => {
    try {
      // Use the provided user object if available, otherwise use the current user from state
      const userToUpdate = userData.user || user;
      
      if (!userToUpdate) throw new Error('No authenticated user');
      
      console.log("Updating profile for user:", userToUpdate.uid);
      
      // Update Firebase user profile with first and last name
      await updateProfile(userToUpdate, {
        displayName: `${userData.firstName} ${userData.lastName}`
      });
      
      // Immediately update local state to avoid delays
      if (userData.user && userData.user.uid === user?.uid) {
        // If it's the current user, update the state
        setUser(userToUpdate);
      }
      return;
    } catch (error) {
      console.error("Error updating user profile:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      startPhoneAuth, 
      confirmOtp, 
      logout, 
      getIdToken,
      updateUserProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};