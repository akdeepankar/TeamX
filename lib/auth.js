import { account, databases, validateClient } from './appwrite'
import { ID } from 'appwrite'

// Fast login functions
export const createAccountWithEmail = async (email, password, name) => {
  try {
    const user = await account.create(
      ID.unique(),
      email,
      password,
      name || undefined
    );
    return { success: true, user };
  } catch (error) {
    const message = (error?.message || '').toLowerCase();
    const code = error?.code;
    if (message.includes('already exists') || code === 409) {
      return { success: false, error: 'EMAIL_EXISTS' };
    }
    if (message.includes('password') && message.includes('length')) {
      throw new Error('Password must be at least 8 characters long.');
    }
    if (message.includes('invalid email') || message.includes('email must be a valid email address')) {
      throw new Error('Please enter a valid email address.');
    }
    throw error;
  }
};

export const signInWithEmail = async (email, password) => {
  try {
    const session = await account.createEmailPasswordSession(email, password);
    return { success: true, session };
  } catch (error) {
    const message = (error?.message || '').toLowerCase();
    const code = error?.code;
    if (code === 401 || message.includes('invalid credentials') || message.includes('invalid email/password')) {
      throw new Error('Incorrect email or password.');
    }
    throw error;
  }
};

export const fastLogin = async (email, password, name) => {
  try {
    // First try to create account
    const createResult = await createAccountWithEmail(email, password, name);
    
    if (createResult.success) {
      // Account created successfully, now sign in
      const signInResult = await signInWithEmail(email, password);
      return { 
        success: true, 
        action: 'CREATED_AND_SIGNED_IN',
        user: createResult.user,
        session: signInResult.session
      };
    } else if (createResult.error === 'EMAIL_EXISTS') {
      // Email exists, try to sign in
      const signInResult = await signInWithEmail(email, password);
      return { 
        success: true, 
        action: 'SIGNED_IN',
        session: signInResult.session
      };
    }
  } catch (error) {
    throw error;
  }
};

// Removed Google OAuth login to support email/password only

export const logoutUser = async () => {
  try {
    await account.deleteSession('current')
  } catch (error) {
    console.error(error)
  }
}

export const getUser = async () => {
  try {
    // Validate client configuration first
    if (!validateClient()) {
      console.error('Appwrite client not properly configured');
      return null;
    }
    
    // Check if account is properly initialized
    if (!account) {
      console.error('Account not initialized');
      return null;
    }
    
    // Simple network connectivity check
    try {
      await fetch('https://nyc.cloud.appwrite.io/v1/health', { 
        method: 'HEAD',
        mode: 'no-cors'
      });
    } catch (networkError) {
      console.error('Network connectivity issue:', networkError);
      throw new Error('Failed to fetch');
    }
    
    return await account.get()
  } catch (error) {
    // If user is not authenticated (guest), return null instead of throwing
    if (error.message.includes('guests') || error.message.includes('missing scope')) {
      console.log('User not authenticated:', error.message)
      return null
    }
    
    // Handle network errors and other issues
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      console.error('Network error getting user:', error.message)
      return null
    }
    
    console.error('Error getting user:', error)
    return null
  }
}

// Gmail/Telegram preferences removed from the application