
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, supabaseConfigError } from '../supabaseClient';

import { getLoginEmailCandidates, usernameToEmail } from '../utils/authEmail';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

const PROFILE_FETCH_TIMEOUT_MS = 5000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (authUser) => {
    if (!supabase || !authUser?.id) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')

      .eq('id', authUser.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    if (!data) {
      console.warn(
        'No profile row found for authenticated user. Ensure handle_new_user trigger + RLS policies are configured in Supabase schema.'
      );
      return null;

    }

    return data;
  }, []);

  const fetchProfileWithTimeout = useCallback(async (authUser) => {
    if (!supabase || !authUser?.id) return null;

    try {
      const timeoutSentinel = Symbol('profile-timeout');
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve(timeoutSentinel), PROFILE_FETCH_TIMEOUT_MS);
      });

      const result = await Promise.race([fetchProfile(authUser), timeoutPromise]);

      if (result === timeoutSentinel) {
        console.warn('Profile fetch timed out; continuing without profile data.');
        return null;
      }

      return result;
    } catch (err) {
      console.error('Unexpected profile fetch error:', err);
      return null;
    }
  }, [fetchProfile]);


  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let isMounted = true;

    const safeSetAuthState = (nextUser, nextProfile) => {
      if (!isMounted) return;
      setUser(nextUser);
      setProfile(nextProfile);
    };

    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting auth session:', error);
          safeSetAuthState(null, null);
          return;
        }

        if (session?.user) {
          const p = await fetchProfileWithTimeout(session.user);
          safeSetAuthState(session.user, p);
        } else {
          safeSetAuthState(null, null);
        }
      } catch (err) {
        console.error('Unexpected auth initialization error:', err);
        safeSetAuthState(null, null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    const loadingTimeout = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 8000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.user) {
          if (isMounted) {
            setUser(session.user);
            setLoading(false);
          }
          const p = await fetchProfileWithTimeout(session.user);
          if (isMounted) setProfile(p);
        } else {
          safeSetAuthState(null, null);
        }
      } catch (err) {
        console.error('Error handling auth state change:', err);
        safeSetAuthState(null, null);
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, [fetchProfileWithTimeout]);

  const signIn = async (usernameOrEmail, password) => {
    if (!supabase) throw new Error(supabaseConfigError || 'Supabase is not configured.');

    const emailCandidates = getLoginEmailCandidates(usernameOrEmail);
    if (emailCandidates.length === 0) {
      throw new Error('Please enter a valid username or email.');
    }

    let lastError = null;
    for (const email of emailCandidates) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) return data;

      lastError = error;
      const msg = (error.message || '').toLowerCase();
      if (!msg.includes('invalid login credentials')) {
        throw error;
      }
    }

    throw lastError || new Error('Login failed');
  };

  const signOut = async () => {
    if (!supabase) return;

    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const signUp = async (username, password, metadata = {}) => {
    if (!supabase) throw new Error(supabaseConfigError || 'Supabase is not configured.');

    const email = usernameToEmail(username);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { ...metadata, username } },
    });
    if (error) throw error;
    return data;
  };

  const value = {
    user,
    profile,
    loading,
    configError: supabaseConfigError,
    signIn,
    signOut,
    signUp,
    refreshProfile: async () => {
      if (user) {
        const p = await fetchProfile(user);
        setProfile(p);
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
