import { useState, useEffect } from 'react';
import type { Subscription } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../supabase';

export function useAuthStatus() {
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    async function checkStatus() {
      if (!isSupabaseConfigured() || !supabase) {
        if (mounted) {
          setIsVerified(true); // For offline dev mode
          setLoading(false);
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setIsVerified(!!data.session?.user?.email_confirmed_at);
        setLoading(false);
      }
    }

    checkStatus();

    let authListener: Subscription | null = null;
    if (isSupabaseConfigured() && supabase) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (mounted) {
          setIsVerified(!!session?.user?.email_confirmed_at);
        }
      });
      authListener = data.subscription;
    }

    return () => {
      mounted = false;
      authListener?.unsubscribe();
    };
  }, []);

  return { isVerified, loading };
}
