import React, { createContext, useCallback, useContext, useEffect, useState, useMemo } from 'react';
import { supabase, supabaseConfigError } from '../supabaseClient';
import { getLoginEmailCandidates, usernameToEmail } from '../utils/authEmail';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

const PROFILE_FETCH_TIMEOUT_MS = 15000;
const PROFILE_POLICY_RECURSION_CODE = '42P17';
const PROFILE_POLICY_RECURSION_MESSAGE =
  'Your Supabase RLS policies are causing recursive reads (42P17). Fix the policy on class_students/profiles and try again.';
const PROFILE_FETCH_TIMEOUT_RESULT = '__PROFILE_FETCH_TIMEOUT__';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const fetchProfile = useCallback(async (authUser) => {
    if (!supabase || !authUser?.id) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) {
      if (error.code === PROFILE_POLICY_RECURSION_CODE) {
        console.warn(PROFILE_POLICY_RECURSION_MESSAGE, error);
        setAuthError(PROFILE_POLICY_RECURSION_MESSAGE);
        return null;
      }

      console.error('Error fetching profile:', error);
      setAuthError('Unable to load your profile. Please check Supabase RLS policies.');
      return null;
    }

    if (!data) {
      console.warn(
        'No profile row found for authenticated user. Ensure handle_new_user trigger + RLS policies are configured in Supabase schema.'
      );
      setAuthError('No profile row found for this account. Please check Supabase setup.');
      return null;
    }

    setAuthError('');
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
        setAuthError('Profile lookup timed out. Please verify Supabase network/policy configuration.');
        return PROFILE_FETCH_TIMEOUT_RESULT;
      }

      return result;
    } catch (err) {
      console.error('Unexpected profile fetch error:', err);
      setAuthError('Unexpected profile lookup error. Check browser console and Supabase logs.');
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
          setAuthError('Unable to initialize auth session.');
          safeSetAuthState(null, null);
          return;
        }

        if (session?.user) {
          const p = await fetchProfileWithTimeout(session.user);
          if (p === PROFILE_FETCH_TIMEOUT_RESULT) {
            if (isMounted) {
              setUser(session.user);
            }
          } else {
            safeSetAuthState(session.user, p);
          }
        } else {
          setAuthError('');
          safeSetAuthState(null, null);
        }
      } catch (err) {
        console.error('Unexpected auth initialization error:', err);
        setAuthError('Unexpected auth initialization error.');
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
          const p = await fetchProfileWithTimeout(session.user);
          if (isMounted) {
            setUser(session.user);
            if (p !== PROFILE_FETCH_TIMEOUT_RESULT) {
              setProfile(p);
            }
          }
        } else {
          setAuthError('');
          safeSetAuthState(null, null);
        }
      } catch (err) {
        console.error('Error handling auth state change:', err);
        setAuthError('Unable to process auth state changes.');
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

  const signIn = useCallback(async (usernameOrEmail, password) => {
    if (!supabase) throw new Error(supabaseConfigError || 'Supabase is not configured.');

    setAuthError('');

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
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;

    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setAuthError('');
  }, []);

  const signUp = useCallback(async (username, password, metadata = {}) => {
    if (!supabase) throw new Error(supabaseConfigError || 'Supabase is not configured.');

    const email = usernameToEmail(username);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { ...metadata, username } },
    });
    if (error) throw error;
    return data;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const p = await fetchProfile(user);
      setProfile(p);
    }
  }, [user, fetchProfile]);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    authError,
    configError: supabaseConfigError,
    signIn,
    signOut,
    signUp,
    refreshProfile,
  }), [user, profile, loading, authError, signIn, signOut, signUp, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
