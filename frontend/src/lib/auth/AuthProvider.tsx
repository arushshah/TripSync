'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
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

// Constants for rate limiting
const MIN_FETCH_INTERVAL = 10000; // 10 seconds minimum between profile fetches
const FETCH_RETRY_DELAY = 5000;   // 5 seconds between fetch retries

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [user_id, setUser_id] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<Error | null>(null);
  
  // Use refs for tracking fetch state to avoid re-renders and dependency issues
  const isProfileFetchInProgress = useRef(false);
  const lastProfileFetchTime = useRef(0);
  const profileFetchDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  const tokenRefreshCount = useRef(0);
  
  // Function to fetch user profile - extracted for reuse
  const fetchUserProfile = useCallback(async (force = false): Promise<void> => {
    if (!auth.currentUser) {
      setUser_id(null);
      return;
    }

    // Skip if a fetch is already in progress
    if (isProfileFetchInProgress.current) {
      return;
    }

    const now = Date.now();
    
    // Rate limiting: Unless forced, don't fetch if we've fetched recently
    if (!force && now - lastProfileFetchTime.current < MIN_FETCH_INTERVAL) {
      return;
    }

    try {
      isProfileFetchInProgress.current = true;
      lastProfileFetchTime.current = now;
      
      // Make a request to get the user profile which should contain the internal ID
      const profile = await api.getUserProfile();
      console.log("Fetched user profile:", profile);
      
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
      
      // Only schedule retry if we still don't have a user_id
      if (!user_id) {
        setTimeout(() => {
          // Reset the in-progress flag to allow the next retry
          isProfileFetchInProgress.current = false;
          fetchUserProfile();
        }, FETCH_RETRY_DELAY);
      }
    } finally {
      // Unless we're waiting for a retry, reset the in-progress flag
      if (user_id || !profileError) {
        isProfileFetchInProgress.current = false;
      }
    }
  }, [user_id]);

  // Function that can be called to manually refresh the profile
  const refreshUserProfile = async (): Promise<void> => {
    console.log("here");
    setLoading(true);
    await fetchUserProfile(true); // Force refresh
    setLoading(false);
  };

  // Token refresh handler with debounce
  const handleTokenRefresh = useCallback(() => {
    tokenRefreshCount.current += 1;
    
    // Clear any existing timer
    if (profileFetchDebounceTimer.current) {
      clearTimeout(profileFetchDebounceTimer.current);
    }
    
    // Debounce the profile fetch to prevent rapid consecutive calls
    profileFetchDebounceTimer.current = setTimeout(() => {
      fetchUserProfile();
      profileFetchDebounceTimer.current = null;
    }, 1000); // 1 second debounce
  }, [fetchUserProfile]);

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("Auth state changed:", currentUser?.uid);
      setUser(currentUser);
      
      if (currentUser) {
        // Token listener to detect when the token refreshes
        const tokenListener = auth.onIdTokenChanged(() => {
          handleTokenRefresh();
        });
        
        // Initial profile fetch
        await fetchUserProfile(true); // Force the initial fetch
        setLoading(false);
        
        return () => {
          tokenListener();
          // Clean up any pending debounce timer
          if (profileFetchDebounceTimer.current) {
            clearTimeout(profileFetchDebounceTimer.current);
          }
        };
      } else {
        // No user is signed in
        setUser_id(null);
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, [fetchUserProfile, handleTokenRefresh]); // Proper dependencies

  // No need for a separate retry effect since we handle retries in fetchUserProfile

  // Rest of your auth functions...
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
      // When confirming OTP, we'll let the auth state change listener handle the profile fetch
      // rather than triggering multiple fetches
      const userCredential = await confirmationResult.confirm(otp);
      
      // We don't need to fetch the profile here as the auth state change listener will do it
      // Just return the user
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

      // Also update the backend database with the new name
      try {
        // Fix: Use the proper API method instead of api.put
        await api.updateUserProfile({
          first_name: userData.firstName,
          last_name: userData.lastName
        });
      } catch (apiError) {
        console.error("Error updating user profile in backend:", apiError);
        // We don't throw here to prevent the entire operation from failing
        // At least the Firebase update succeeded
      }

      // After updating both Firebase and backend profiles, fetch the latest internal user profile
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