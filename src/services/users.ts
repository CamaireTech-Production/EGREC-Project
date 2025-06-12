import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface UserData {
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  agencyName?: string;
  photoURL?: string;
  createdAt: string;
  lastLoginAt: string;
  isActive: boolean;
  role: 'CAISSIERE' | 'GESTIONNAIRE' | 'ADMINISTRATEUR' | 'PRODUCTEUR';
}

export const createUserDocument = async (uid: string, userData: Partial<UserData>) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      const newUser = {
        ...userData,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        isActive: true,
        role: 'CAISSIERE' as const,
      };

      await setDoc(userRef, newUser);
      return { success: true, data: newUser };
    }

    return { success: false, error: 'User already exists' };
  } catch (error) {
    console.error('Error creating user document:', error);
    return { success: false, error };
  }
};

export const updateUserLoginTimestamp = async (uid: string) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      lastLoginAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating login timestamp:', error);
    return { success: false, error };
  }
};

export const updateUserProfile = async (uid: string, data: Partial<UserData>) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, data);
    return { success: true };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return { success: false, error };
  }
};

export const getUserData = async (uid: string) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return { success: true, data: userDoc.data() as UserData };
    }
    
    return { success: false, error: 'User not found' };
  } catch (error) {
    console.error('Error fetching user data:', error);
    return { success: false, error };
  }
};