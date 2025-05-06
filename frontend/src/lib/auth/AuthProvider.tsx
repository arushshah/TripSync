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
import { api } from '../api';

// Extend the context type to include user_id
type AuthContextType = {
  user: User | null;
  user_id: string | null;
  loading: boolean;
  startPhoneAuth: (phoneNumber: string) => Promise<ConfirmationResult | null>;
  confirmOtp: (confirmationResult: ConfirmationResult, otp: string, bypassValidation?: boolean) => Promise<User | null>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  updateUserProfile: (userData: { firstName: string; lastName: string; user?: User }) => Promise<void>;
  refreshUserProfile: () => Promise<void>; // Add a way to manually refresh profile
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [user_id, setUser_id] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<Error | null>(null);
  const [lastTokenRefresh, setLastTokenRefresh] = useState<number>(0);

  // Function to fetch user profile - extracted for reuse
  const fetchUserProfile = async (): Promise<void> => {
    if (!auth.currentUser) {
      setUser_id(null);
      return;
    }

    try {
      // Ensure we have a fresh token before making the request
      await auth.currentUser.getIdToken(true);
      
      // Make a request to get the user profile which should contain the internal ID
      const profile = await api.getUserProfile();
      console.log("Fetched user profile successfully:", profile);
      
      if (profile && profile.id) {
        setUser_id(profile.id);
        setProfileError(null);
      } else {
        console.error("User profile response missing ID field:", profile);
        setProfileError(new Error("User profile missing ID"));
      }
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
      setProfileError(error instanceof Error ? error : new Error(String(error)));
      // Don't reset user_id here to avoid flashing UI if it's a temporary error
    }
  };

  // Function that can be called to manually refresh the profile
  const refreshUserProfile = async (): Promise<void> => {
    setLoading(true);
    await fetchUserProfile();
    setLoading(false);
  };

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("Auth state changed:", currentUser?.uid);
      setUser(currentUser);
      
      if (currentUser) {
        // Token listener to detect when the token refreshes
        const tokenListener = auth.onIdTokenChanged(() => {
          const now = Date.now();
          // Only trigger a profile refresh if it's been at least 1 second since the last one
          // This prevents multiple rapid refreshes
          if (now - lastTokenRefresh > 1000) {
            setLastTokenRefresh(now);
            console.log("Token refreshed, fetching updated profile");
            fetchUserProfile();
          }
        });
        
        // Initial profile fetch
        await fetchUserProfile();
        setLoading(false);
        
        return () => {
          tokenListener();
        };
      } else {
        // No user is signed in
        setUser_id(null);
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, [lastTokenRefresh]); // Include lastTokenRefresh in dependencies

  // Retry profile fetch if it failed initially and we have a user but no user_id
  useEffect(() => {
    if (user && !user_id && profileError) {
      const retryTimer = setTimeout(() => {
        console.log("Retrying user profile fetch...");
        fetchUserProfile();
      }, 3000); // Retry after 3 seconds
      
      return () => clearTimeout(retryTimer);
    }
  }, [user, user_id, profileError]);

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
      setUser_id(null);
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
      const userToUpdate = userData.user || user;
      
      if (!userToUpdate) throw new Error('No authenticated user');
      
      console.log("Updating profile for user:", userToUpdate.uid);
      
      // Update Firebase user profile with first and last name
      await updateProfile(userToUpdate, {
        displayName: `${userData.firstName} ${userData.lastName}`
      });
      
      // Immediately update local state to avoid delays
      if (userData.user && userData.user.uid === user?.uid) {
        setUser(userToUpdate);
      }

      // After updating Firebase profile, also fetch the latest internal user profile
      await fetchUserProfile();
      
      return;
    } catch (error) {
      console.error("Error updating user profile:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      user_id,
      loading, 
      startPhoneAuth, 
      confirmOtp, 
      logout, 
      getIdToken,
      updateUserProfile,
      refreshUserProfile
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