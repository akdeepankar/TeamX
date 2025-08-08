'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, signInWithEmail, createAccountWithEmail } from "../lib/auth";

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await getUser();
        if (currentUser) {
          router.push('/dashboard');
        } else {
          setUser(null);
        }
      } catch (error) {
        console.log('User not authenticated');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (!email.trim() || !password.trim()) {
        throw new Error('Email and password are required');
      }
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long.');
      }
      // Validate client configuration up front for clearer errors
      const { validateClient } = await import('../lib/appwrite');
      if (!validateClient()) {
        throw new Error('App configuration issue. Please set NEXT_PUBLIC_APPWRITE_ENDPOINT and NEXT_PUBLIC_APPWRITE_PROJECT_ID.');
      }

      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password);
      } else {
        const result = await createAccountWithEmail(email.trim(), password);
        if (!result?.success) {
          if (result.error === 'EMAIL_EXISTS') {
            throw new Error('This email is already registered. Please sign in.');
          }
          throw new Error('Failed to create account');
        }
        await signInWithEmail(email.trim(), password);
      }
      router.push('/dashboard');
    } catch (err) {
      setError(err?.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo and Brand */}
        <div className="text-center mb-8">
          <img 
            src="/next.svg" 
            alt="Logo" 
            className="h-12 w-12 object-contain mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome
          </h1>
          <p className="text-gray-600">
            Sign in with your email and password
          </p>
        </div>

        {/* Email/Password Auth */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${submitting ? 'bg-gray-300 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                {mode === 'signin' ? 'Need an account?' : 'Have an account?'}
              </button>
            </div>
          </form>
        </div>

        {/* Links removed (OAuth-specific) */}
      </div>
    </div>
  );
}
