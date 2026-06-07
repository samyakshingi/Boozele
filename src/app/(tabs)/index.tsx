import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Animated,
  PanResponder,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { supabase } from '@/utils/supabase';

interface NearbyUser {
  id: string;
  username: string;
  avatar_urls: string[] | null;
  drink_preferences: string[] | null;
  intents: string[] | null;
  date_of_birth: string;
  distance_meters: number;
}

interface MatchData {
  conversationId: string;
  username: string;
  avatarUrl: string | null;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 0.25 * SCREEN_WIDTH;

export default function SwipeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  // State to hold active match details
  const [matchData, setMatchData] = useState<MatchData | null>(null);

  // Animated and Gesture values
  const [position] = useState(() => new Animated.ValueXY());
  const stateRef = useRef({ currentIndex, nearbyUsers });

  useEffect(() => {
    stateRef.current = { currentIndex, nearbyUsers };
  }, [currentIndex, nearbyUsers]);

  const fetchNearbyUsers = async () => {
    setLoading(true);
    setErrorMsg('');
    setPermissionDenied(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }

      const locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = locationData.coords;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const wktPoint = `POINT(${longitude} ${latitude})`;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ location: wktPoint })
        .eq('id', user.id);

      if (updateError) {
        console.error('Failed to update location:', updateError.message);
      }

      const { data: list, error: rpcError } = await supabase.rpc('get_nearby_drinkers', {
        lat: latitude,
        lon: longitude,
        radius_km: 25.0,
      });

      if (rpcError) {
        setErrorMsg(rpcError.message);
      } else if (list) {
        setNearbyUsers(list);
        setCurrentIndex(0);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during location sync.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNearbyUsers();
  }, []);

  const handleSwipe = async (isRight: boolean) => {
    const { currentIndex: currIdx, nearbyUsers: users } = stateRef.current;
    const swipedUser = users[currIdx];
    if (!swipedUser) return;

    // Optimistically advance stack
    setCurrentIndex((prev) => prev + 1);
    position.setValue({ x: 0, y: 0 });

    try {
      const { data, error } = await supabase.rpc('process_swipe', {
        target_id: swipedUser.id,
        is_right: isRight,
      });

      if (!error && data && data.is_match) {
        setMatchData({
          conversationId: data.conversation_id,
          username: swipedUser.username,
          avatarUrl: swipedUser.avatar_urls?.[0] || null,
        });
      }
    } catch (err) {
      console.error('Background swipe error:', err);
    }
  };

  const triggerSwipeRight = () => {
    Animated.timing(position, {
      toValue: { x: SCREEN_WIDTH + 120, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => {
      handleSwipe(true);
    });
  };

  const triggerSwipeLeft = () => {
    Animated.timing(position, {
      toValue: { x: -SCREEN_WIDTH - 120, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => {
      handleSwipe(false);
    });
  };

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 4,
      useNativeDriver: false,
    }).start();
  };

  // Configure PanResponder
  // eslint-disable-next-line react-hooks/refs
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        position.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { currentIndex: currIdx, nearbyUsers: users } = stateRef.current;
        if (currIdx >= users.length) {
          resetPosition();
          return;
        }

        if (gestureState.dx > SWIPE_THRESHOLD) {
          Animated.timing(position, {
            toValue: { x: SCREEN_WIDTH + 120, y: gestureState.dy },
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            handleSwipe(true);
          });
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          Animated.timing(position, {
            toValue: { x: -SCREEN_WIDTH - 120, y: gestureState.dy },
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            handleSwipe(false);
          });
        } else {
          resetPosition();
        }
      },
    })
  );

  // Interpolate rotation angle based on swipe drag distance
  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const cardStyle = {
    transform: [
      { translateX: position.x },
      { translateY: position.y },
      { rotate: rotate },
    ],
  };

  const calculateAge = (dobString: string): number => {
    if (!dobString) return 21;
    const dob = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator color="#ff5167" size="large" />
          <Text style={styles.loadingText}>Syncing GPS location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (permissionDenied) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Ionicons name="location-outline" size={64} color="#ff5167" style={styles.iconSpacing} />
          <Text style={styles.errorText}>
            Boozele needs your location to find nearby drinkers.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => Linking.openSettings()}>
            <Text style={styles.primaryButtonText}>Open System Settings</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMsg) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Ionicons name="location-outline" size={64} color="#ff5167" style={styles.iconSpacing} />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={fetchNearbyUsers}>
            <Text style={styles.primaryButtonText}>Retry Proximity Search</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const hasCards = currentIndex < nearbyUsers.length;
  const currentProfile = hasCards ? nearbyUsers[currentIndex] : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      {hasCards && currentProfile ? (
        <View style={styles.container}>
          {/* Card Container */}
          <Animated.View
            style={[styles.cardContainer, cardStyle]}
            {...panResponder.panHandlers}
          >
            {currentProfile.avatar_urls && currentProfile.avatar_urls.length > 0 ? (
              <Image source={{ uri: currentProfile.avatar_urls[0] }} style={styles.cardImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="person-outline" size={80} color="#e6bcbd" />
              </View>
            )}

            {/* Dark linear gradient overlay block at the bottom */}
            <View style={styles.gradientOverlay}>
              {/* Profile Details (Glass card feel) */}
              <View style={styles.glassCard}>
                <View style={styles.profileHeaderRow}>
                  <Text style={styles.profileName}>
                    {currentProfile.username}, {calculateAge(currentProfile.date_of_birth)}
                  </Text>
                </View>

                {/* Distance and Location */}
                <View style={styles.metadataRow}>
                  <Ionicons name="navigate-circle-outline" size={14} color="#4b8eff" style={styles.metaIcon} />
                  <Text style={styles.metadataText}>
                    {(currentProfile.distance_meters / 1000).toFixed(1)} km away
                  </Text>
                </View>

                {/* Drink DNA Chips */}
                {currentProfile.drink_preferences && currentProfile.drink_preferences.length > 0 && (
                  <View style={styles.tagContainer}>
                    {currentProfile.drink_preferences.slice(0, 3).map((pref, idx) => (
                      <View key={idx} style={styles.drinkTag}>
                        <Text style={styles.drinkTagText}>{pref}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Intents */}
                {currentProfile.intents && currentProfile.intents.length > 0 && (
                  <View style={styles.intentRow}>
                    <Text style={styles.intentLabelText}>Looking for: </Text>
                    <Text style={styles.intentValueText}>
                      {currentProfile.intents.map((intent) => 
                        intent === '1-on-1' ? 'Chill 1-on-1 drinks' : 'Group Hangs'
                      ).join(' & ')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>

          {/* Action buttons (Pass / Match) */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionButtonPass} onPress={triggerSwipeLeft} activeOpacity={0.8}>
              <Ionicons name="close" size={28} color="#e6bcbd" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButtonMatch} onPress={triggerSwipeRight} activeOpacity={0.8}>
              <Ionicons name="beer" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.centerContainer}>
          <Ionicons name="beer-outline" size={72} color="#fecb00" style={styles.iconSpacing} />
          <Text style={styles.emptyTitle}>{"You've cleared the stack!"}</Text>
          <Text style={styles.emptySubtitle}>
            There are no other active drinkers within 25km of your location right now.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={fetchNearbyUsers}>
            <Text style={styles.primaryButtonText}>Refresh Proximity Scan</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Match Overlay */}
      {matchData && (
        <View style={styles.matchOverlay}>
          <Text style={styles.matchTitle}>{"It's a Match!"}</Text>
          <Text style={styles.matchSubtitle}>
            {"You and " + matchData.username + " can now plan a night out."}
          </Text>

          {/* Overlapping Cheers Avatars */}
          <View style={styles.matchAvatarsContainer}>
            <View style={styles.matchAvatarCircle}>
              {matchData.avatarUrl ? (
                <Image source={{ uri: matchData.avatarUrl }} style={styles.matchAvatarImage} />
              ) : (
                <Ionicons name="person-outline" size={48} color="#e5e2e1" />
              )}
            </View>
            <View style={styles.matchIconCircle}>
              <Ionicons name="beer-outline" size={36} color="#fecb00" />
            </View>
          </View>

          {/* CTA Buttons */}
          <View style={styles.matchCtaContainer}>
            <TouchableOpacity
              style={styles.matchCtaPrimary}
              activeOpacity={0.8}
              onPress={() => {
                const convoId = matchData.conversationId;
                setMatchData(null);
                router.push(`/chat/${convoId}`);
              }}
            >
              <Text style={styles.matchCtaPrimaryText}>Send a Message</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.matchCtaSecondary}
              activeOpacity={0.8}
              onPress={() => setMatchData(null)}
            >
              <Text style={styles.matchCtaSecondaryText}>Keep Swiping</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#131313', // Level 0 background per DESIGN.md
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  cardContainer: {
    flex: 1,
    borderRadius: 24, // 24px container corner radius
    overflow: 'hidden',
    backgroundColor: '#201f1f', // Level 1 surface card
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#201f1f',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(19, 19, 19, 0.85)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  glassCard: {
    padding: 8,
    borderRadius: 16,
  },
  profileHeaderRow: {
    marginBottom: 6,
  },
  profileName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#e5e2e1', // High contrast white
    fontFamily: 'Inter',
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  metaIcon: {
    marginRight: 6,
  },
  metadataText: {
    fontSize: 14,
    color: '#4b8eff', // Cyan tertiary token
    fontFamily: 'Inter',
    fontWeight: '600',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  drinkTag: {
    backgroundColor: '#fecb00', // Amber secondary-container
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999, // Pill shaped
  },
  drinkTagText: {
    fontSize: 11,
    color: '#131313', // High contrast dark text on Amber
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  intentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 10,
  },
  intentLabelText: {
    fontSize: 12,
    color: '#e6bcbd',
    fontFamily: 'Inter',
  },
  intentValueText: {
    fontSize: 12,
    color: '#e5e2e1',
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
    marginTop: 20,
    marginBottom: 4,
  },
  actionButtonPass: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#201f1f',
    borderColor: '#5d3f40', // outline-variant
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  actionButtonMatch: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ff5167', // Primary Pink
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff5167',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#131313',
  },
  loadingText: {
    marginTop: 16,
    color: '#e6bcbd',
    fontSize: 14,
    fontFamily: 'Inter',
  },
  iconSpacing: {
    marginBottom: 20,
  },
  errorText: {
    color: '#ff5167',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    fontFamily: 'Inter',
  },
  primaryButton: {
    backgroundColor: '#ff5167',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 9999, // Pill shaped
    shadowColor: '#ff5167',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    fontFamily: 'Inter',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#e5e2e1',
    fontFamily: 'Inter',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#e6bcbd',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    fontFamily: 'Inter',
  },
  matchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(19, 19, 19, 0.96)', // Velvet True Dark
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 9999,
  },
  matchTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: '#ff5167', // Glowing pink title
    fontFamily: 'Inter',
    marginBottom: 12,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 81, 103, 0.4)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  matchSubtitle: {
    fontSize: 16,
    color: '#e5e2e1',
    textAlign: 'center',
    fontFamily: 'Inter',
    lineHeight: 24,
    marginBottom: 40,
  },
  matchAvatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 50,
  },
  matchAvatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#ff5167', // Pink border outline
    overflow: 'hidden',
    backgroundColor: '#201f1f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchAvatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  matchIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#fecb00', // Amber border outline
    backgroundColor: '#201f1f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchCtaContainer: {
    width: '100%',
    gap: 16,
    paddingHorizontal: 8,
  },
  matchCtaPrimary: {
    width: '100%',
    backgroundColor: '#ff5167', // Primary Pink
    borderRadius: 9999, // Pill shaped
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff5167',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  matchCtaPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Inter',
  },
  matchCtaSecondary: {
    width: '100%',
    backgroundColor: 'transparent',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1.5,
    borderRadius: 9999, // Pill shaped
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchCtaSecondaryText: {
    color: '#e5e2e1',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
});
