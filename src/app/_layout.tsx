import React, { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider, Slot, useRouter, useSegments } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

import { StripeProvider } from '@stripe/stripe-react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();
  const segments = useSegments() as string[];
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

  useEffect(() => {
    // Fetch initial auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    // Subscribe to real-time auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setInitialized(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onSetupProfile = segments[0] === '(auth)' && segments[1] === 'setup-profile';

    if (!session) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfileComplete(null);
      if (!inAuthGroup) {
        router.replace('/login');
      }
      return;
    }

    if (profileComplete === null) {
      // Check if profile is complete
      supabase
        .from('profiles')
        .select('drink_preferences')
        .eq('id', session.user.id)
        .single()
        .then(({ data, error }) => {
          const complete = !error && data && data.drink_preferences && data.drink_preferences.length > 0;
          setProfileComplete(complete);
        });
      return;
    }

    if (!profileComplete) {
      if (!onSetupProfile) {
        // Re-verify in case the profile was just saved
        supabase
          .from('profiles')
          .select('drink_preferences')
          .eq('id', session.user.id)
          .single()
          .then(({ data, error }) => {
            const complete = !error && data && data.drink_preferences && data.drink_preferences.length > 0;
            setProfileComplete(complete);
            if (!complete) {
              router.replace('/setup-profile');
            }
          });
      }
    } else {
      if (inAuthGroup) {
        router.replace('/');
      }
    }
  }, [session, initialized, segments, router, profileComplete]);

  if (!initialized) {
    return <AnimatedSplashOverlay />;
  }

  return (
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_KEY || ''}>
      <ThemeProvider value={DarkTheme}>
        <AnimatedSplashOverlay />
        {session ? <Slot /> : <Slot />}
      </ThemeProvider>
    </StripeProvider>
  );
}
