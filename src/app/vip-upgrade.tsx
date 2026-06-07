import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '@/utils/supabase';

export default function VIPUpgradeScreen() {
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);
  const [isVip, setIsVip] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login');
      } else {
        setCurrentUser(user);
        // Check current VIP status
        supabase
          .from('profiles')
          .select('is_vip')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data?.is_vip) {
              setIsVip(true);
            }
          });
      }
    });
  }, [router]);

  const fetchPaymentSheetParams = async () => {
    // Under production, this invokes a secure Supabase Edge Function:
    // const { data, error } = await supabase.functions.invoke('create-payment-intent');
    // For development, we return mock parameters.
    return {
      paymentIntent: 'pi_mock_intent_secret_123456',
      ephemeralKey: 'ek_mock_customer_ephemeral_123456',
      customer: 'cus_mock_customer_123456',
    };
  };

  const handleUpgradeNow = async () => {
    if (!currentUser) return;
    setLoading(true);

    try {
      const { paymentIntent, ephemeralKey, customer } = await fetchPaymentSheetParams();

      // Initialize the Stripe Payment Sheet
      const { error: initError } = await initPaymentSheet({
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: paymentIntent,
        merchantDisplayName: 'Boozele, Inc.',
      });

      if (initError) {
        console.warn('Stripe Init Error:', initError.message);
        // If keys are invalid (mock/unset in local dev env), fallback to mock testing prompt
        triggerMockUpgradePrompt();
        return;
      }

      // Present the Payment Sheet to the user
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          Alert.alert('Payment Canceled', 'You cancelled the payment.');
        } else {
          // Present error (due to invalid mock credentials in local testing), trigger fallback
          triggerMockUpgradePrompt();
        }
      } else {
        // Payment succeeded! In production, the webhook updates public.profiles.is_vip.
        // For local simulation, we trigger our secure test RPC.
        await executeVipUpgrade();
      }
    } catch (err: any) {
      console.error(err);
      triggerMockUpgradePrompt();
    } finally {
      setLoading(false);
    }
  };

  const triggerMockUpgradePrompt = () => {
    Alert.alert(
      'Stripe Dev Mode Fallback',
      'Stripe publishable/secret keys are mock/unset in your local environment. Would you like to simulate a successful purchase and upgrade to VIP?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upgrade to VIP',
          onPress: async () => {
            setLoading(true);
            await executeVipUpgrade();
            setLoading(false);
          },
        },
      ]
    );
  };

  const executeVipUpgrade = async () => {
    if (!currentUser) return;
    try {
      // Invoke the security definer RPC to securely upgrade the profile VIP status
      const { error } = await supabase.rpc('test_vip_upgrade', {
        target_user_id: currentUser.id,
      });

      if (error) {
        Alert.alert('Upgrade Failed', error.message);
      } else {
        setIsVip(true);
        Alert.alert('Welcome to VIP!', 'Your account has been upgraded successfully.', [
          { text: 'Sweet!', onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Upgrade Failed', err.message || 'An error occurred.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#e5e2e1" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>VIP Upgrade</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* VIP Premium Card Frame */}
        <View style={styles.premiumCard}>
          <Ionicons name="ribbon" size={48} color="#fecb00" style={styles.premiumIcon} />
          <Text style={styles.premiumTitle}>BOOZELE VIP</Text>
          <Text style={styles.premiumSubtitle}>Elevate your social drinking experience</Text>

          {isVip && (
            <View style={styles.vipBadge}>
              <Text style={styles.vipBadgeText}>ACTIVE VIP MEMBER</Text>
            </View>
          )}
        </View>

        {/* Benefits Checklist */}
        <View style={styles.benefitsContainer}>
          <Text style={styles.benefitsHeader}>VIP EXCLUSIVE BENEFITS</Text>

          {/* Benefit 1 */}
          <View style={styles.benefitRow}>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={16} color="#131313" />
            </View>
            <View style={styles.benefitTextContainer}>
              <Text style={styles.benefitTitle}>See Who Liked You</Text>
              <Text style={styles.benefitDesc}>Skip the swipe and instantly reveal matches who swiped right on you.</Text>
            </View>
          </View>

          {/* Benefit 2 */}
          <View style={styles.benefitRow}>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={16} color="#131313" />
            </View>
            <View style={styles.benefitTextContainer}>
              <Text style={styles.benefitTitle}>Unlimited Proximity Swipes</Text>
              <Text style={styles.benefitDesc}>Swipe on as many nearby drinkers as you want without daily limits.</Text>
            </View>
          </View>

          {/* Benefit 3 */}
          <View style={styles.benefitRow}>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={16} color="#131313" />
            </View>
            <View style={styles.benefitTextContainer}>
              <Text style={styles.benefitTitle}>Priority House Parties Pins</Text>
              <Text style={styles.benefitDesc}>Highlight your hosted events in the parties feed to double your RSVP rate.</Text>
            </View>
          </View>

          {/* Benefit 4 */}
          <View style={styles.benefitRow}>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={16} color="#131313" />
            </View>
            <View style={styles.benefitTextContainer}>
              <Text style={styles.benefitTitle}>Ad-Free VIP Status</Text>
              <Text style={styles.benefitDesc}>Enjoy an ad-free premium nightlife lounge interface with zero interruptions.</Text>
            </View>
          </View>
        </View>

        {/* Action Button */}
        {!isVip ? (
          <View style={styles.footer}>
            <Text style={styles.pricingText}>$4.99 / Month</Text>
            <Text style={styles.pricingSub}>Cancel anytime. Secure checkout powered by Stripe.</Text>
            
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              activeOpacity={0.8}
              onPress={handleUpgradeNow}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Upgrade Now</Text>
                  <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.footer}>
            <Text style={styles.pricingSub}>You are a VIP. Thank you for supporting Boozele!</Text>
            <TouchableOpacity
              style={styles.backHomeButton}
              activeOpacity={0.8}
              onPress={() => router.back()}
            >
              <Text style={styles.backHomeButtonText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#131313', // Level 0 background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#201f1f',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#e5e2e1',
    fontFamily: 'Inter',
  },
  scrollContent: {
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  premiumCard: {
    backgroundColor: '#201f1f', // Level 1 Card surface
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#fecb00', // Gold/Amber Accent border glow
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#fecb00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  premiumIcon: {
    marginBottom: 12,
  },
  premiumTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fecb00', // Gold title
    fontFamily: 'Inter',
    letterSpacing: 2,
    marginBottom: 4,
  },
  premiumSubtitle: {
    fontSize: 12,
    color: '#e6bcbd', // variant muted text
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  vipBadge: {
    marginTop: 16,
    backgroundColor: '#fecb00',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 9999, // Pill shape
  },
  vipBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#131313',
    fontFamily: 'Inter',
  },
  benefitsContainer: {
    marginBottom: 40,
  },
  benefitsHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#e6bcbd',
    fontFamily: 'Inter',
    letterSpacing: 1,
    marginBottom: 20,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 14,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fecb00', // Gold Check background
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  benefitTextContainer: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e5e2e1',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  benefitDesc: {
    fontSize: 12,
    color: '#e6bcbd',
    fontFamily: 'Inter',
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    marginTop: 10,
  },
  pricingText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#e5e2e1',
    fontFamily: 'Inter',
    marginBottom: 6,
  },
  pricingSub: {
    fontSize: 11,
    color: '#e6bcbd',
    textAlign: 'center',
    fontFamily: 'Inter',
    lineHeight: 16,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#ff5167', // Electric Pink Primary
    borderRadius: 9999, // Pill shaped
    width: '100%',
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#ff5167',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#5d3f40',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    fontFamily: 'Inter',
  },
  backHomeButton: {
    borderColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1.5,
    borderRadius: 9999,
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backHomeButtonText: {
    color: '#e5e2e1',
    fontWeight: '700',
    fontSize: 15,
    fontFamily: 'Inter',
  },
});
