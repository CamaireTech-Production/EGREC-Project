import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { toast } from 'react-hot-toast';

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  agencyName: string;
  role: string;
}

interface UserContextType {
  user: UserData | null;
  loading: boolean;
  error: string | null;
  isOffline: boolean;
}

const USER_CACHE_KEY = 'cached_user_data';
const CACHE_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours

const UserContext = createContext<UserContextType | undefined>(undefined);

const getCachedUserData = (): { data: UserData | null; timestamp: number } | null => {
  try {
    const cached = localStorage.getItem(USER_CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    
    // Check if cache is expired
    if (Date.now() - timestamp > CACHE_EXPIRY_TIME) {
      localStorage.removeItem(USER_CACHE_KEY);
      return null;
    }
    
    return { data, timestamp };
  } catch (error) {
    console.error('Error reading cached user data:', error);
    return null;
  }
};

const cacheUserData = (userData: UserData) => {
  try {
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify({
      data: userData,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Error caching user data:', error);
  }
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(() => {
    const cached = getCachedUserData();
    return cached ? cached.data : null;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Connexion rétablie');
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast('Mode hors-ligne activé', {
        icon: '🔌',
        duration: 4000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // If offline, try to use cached data
          if (!navigator.onLine) {
            const cachedData = getCachedUserData();
            if (cachedData && cachedData.data && cachedData.data.id === firebaseUser.uid) {
              setUser(cachedData.data);
              setError(null);
              setLoading(false);
              return;
            }
          }

          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            
            if (!userDoc.exists()) {
              setError('User data not found');
              setUser(null);
              return;
            }

            const userData = userDoc.data();
            
            if (!userData.company || !userData.agencyName) {
              setError('Company or agency information missing');
              setUser(null);
              return;
            }

            const userDataObj: UserData = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              firstName: userData.firstName || '',
              lastName: userData.lastName || '',
              company: userData.company,
              agencyName: userData.agencyName,
              role: userData.role || ''
            };

            setUser(userDataObj);
            cacheUserData(userDataObj);
            setError(null);
          } catch (error) {
            console.error('Error fetching user data:', error);
            
            // If fetch fails and we're offline, try to use cached data
            if (!navigator.onLine) {
              const cachedData = getCachedUserData();
              if (cachedData && cachedData.data && cachedData.data.id === firebaseUser.uid) {
                setUser(cachedData.data);
                setError(null);
                return;
              }
            }
            
            throw error;
          }
        } else {
          setUser(null);
          localStorage.removeItem(USER_CACHE_KEY);
          setError(null);
        }
      } catch (err) {
        console.error('Error in auth state change:', err);
        setError('Error loading user data');
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, error, isOffline }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};