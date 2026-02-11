import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (authUser) => {
    const userId = authUser.id;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      console.error('Error fetching profile:', error);
      // Profile missing — trigger may not have fired (e.g. user created via Dashboard).
      // Auto-create profile from auth user metadata.
      const meta = authUser.user_metadata || {};
      const email = authUser.email || '';
      const username = meta.username || email.split('@')[0] || userId.slice(0, 8);
      const { data: inserted, error: insertErr } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          username,
          email,
          full_name: meta.full_name || '',
          role: meta.role || 'student',
        }, { onConflict: 'id' })
        .select()
        .single();
      if (insertErr) {
        console.error('Error creating profile:', insertErr);
        return null;
      }
      return inserted;
    }
    return data;
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        const p = await fetchProfile(session.user);
        setProfile(p);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          const p = await fetchProfile(session.user);
          setProfile(p);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const toEmail = (username) => `${username.toLowerCase().trim()}@storeit.app`;

  const signIn = async (username, password) => {
    const email = toEmail(username);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const signUp = async (username, password, metadata = {}) => {
    const email = toEmail(username);
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
    signIn,
    signOut,
    signUp,
    refreshProfile: async () => {
      if (user) {
        const p = await fetchProfile(user.id);
        setProfile(p);
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
