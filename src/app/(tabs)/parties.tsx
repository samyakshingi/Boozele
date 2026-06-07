import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';

interface PartyPlan {
  id: string;
  title: string;
  event_time: string;
  venue: string | null;
  menu: string | null;
  conversation_id: string;
  host_id: string;
  profiles: {
    username: string;
    avatar_urls: string[] | null;
  } | null;
}

export default function PartiesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [parties, setParties] = useState<PartyPlan[]>([]);
  const [joinedConvos, setJoinedConvos] = useState<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [rsvpingPartyId, setRsvpingPartyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Fetch active session on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });
  }, []);

  // 2. Fetch parties and user memberships
  const fetchPartiesAndMemberships = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setErrorMsg('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch active public plans (event_time in the future)
      const { data: plansData, error: plansError } = await supabase
        .from('plans')
        .select(`
          id,
          title,
          event_time,
          venue,
          menu,
          conversation_id,
          host_id,
          profiles:host_id (
            username,
            avatar_urls
          )
        `)
        .eq('is_public', true)
        .gte('event_time', new Date().toISOString())
        .order('event_time', { ascending: true });

      if (plansError) throw plansError;

      // Fetch user's conversation memberships to see which parties they already joined
      const { data: membersData, error: membersError } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (membersError) throw membersError;

      const joinedConvosSet = new Set<string>(
        membersData?.map((m: any) => m.conversation_id) || []
      );

      setJoinedConvos(joinedConvosSet);
      setParties((plansData as any) || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to retrieve public party listings.');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Re-fetch data whenever tab is focused
  useFocusEffect(
    useCallback(() => {
      fetchPartiesAndMemberships(parties.length === 0);
    }, [parties.length])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPartiesAndMemberships(false);
  };

  const handleRSVP = async (party: PartyPlan) => {
    if (!currentUser) return;
    setRsvpingPartyId(party.id);
    try {
      // Insert current user into conversation_members junction table
      const { error } = await supabase
        .from('conversation_members')
        .insert({
          conversation_id: party.conversation_id,
          user_id: currentUser.id,
        });

      // Handle unique constraint (if already a member but state wasn't synced)
      if (error && error.code !== '23505') {
        throw error;
      }

      // Optimistically add to joined list
      setJoinedConvos((prev) => {
        const next = new Set(prev);
        next.add(party.conversation_id);
        return next;
      });

      // Route directly to chat room
      router.push(`/chat/${party.conversation_id}`);
    } catch (err: any) {
      Alert.alert('RSVP Failed', err.message || 'An error occurred during RSVP.');
    } finally {
      setRsvpingPartyId(null);
    }
  };

  const renderPartyItem = ({ item }: { item: PartyPlan }) => {
    const isJoined = joinedConvos.has(item.conversation_id);
    const hostProfile = item.profiles;
    const hostAvatar = hostProfile?.avatar_urls?.[0];
    const eventDate = new Date(item.event_time);

    const formattedTime = eventDate.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }) + ' @ ' + eventDate.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        
        {/* Date & Time info */}
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={14} color="#ff5167" style={styles.infoIcon} />
          <Text style={styles.infoText}>{formattedTime}</Text>
        </View>

        {/* Venue info */}
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={14} color="#4b8eff" style={styles.infoIcon} />
          <Text style={styles.infoText} numberOfLines={1}>
            {item.venue || 'TBD'}
          </Text>
        </View>

        {/* Separator */}
        <View style={styles.divider} />

        {/* Host Info & Action Button */}
        <View style={styles.bottomRow}>
          <View style={styles.hostContainer}>
            {hostAvatar ? (
              <Image source={{ uri: hostAvatar }} style={styles.hostAvatar} />
            ) : (
              <View style={styles.hostAvatarPlaceholder}>
                <Ionicons name="person" size={14} color="#e6bcbd" />
              </View>
            )}
            <View>
              <Text style={styles.hostLabel}>HOSTED BY</Text>
              <Text style={styles.hostName} numberOfLines={1}>
                {hostProfile?.username || 'Unknown'}
              </Text>
            </View>
          </View>

          {isJoined ? (
            <TouchableOpacity
              style={styles.joinedButton}
              activeOpacity={0.8}
              onPress={() => router.push(`/chat/${item.conversation_id}`)}
            >
              <Text style={styles.joinedButtonText}>Enter Chat</Text>
              <Ionicons name="chatbubbles-outline" size={14} color="#4b8eff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.rsvpButton}
              activeOpacity={0.8}
              disabled={rsvpingPartyId === item.id}
              onPress={() => handleRSVP(item)}
            >
              {rsvpingPartyId === item.id ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.rsvpButtonText}>RSVP</Text>
                  <Ionicons name="beer" size={14} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Parties & Events</Text>
        <Text style={styles.headerSubtitle}>Discover public house parties & gathers nearby</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color="#ff5167" size="large" />
          <Text style={styles.loadingText}>Retrieving events feed...</Text>
        </View>
      ) : errorMsg ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ff5167" style={styles.errorIcon} />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchPartiesAndMemberships(true)}>
            <Text style={styles.retryButtonText}>Retry Fetch</Text>
          </TouchableOpacity>
        </View>
      ) : parties.length === 0 ? (
        <FlatList
          data={[]}
          renderItem={null}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#ff5167" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="beer-outline" size={72} color="#fecb00" style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No Parties Tonight</Text>
              <Text style={styles.emptySubtitle}>
                No active public gatherings found in your area. Be the spark and host one yourself!
              </Text>
              <TouchableOpacity
                style={styles.hostPartyButton}
                activeOpacity={0.8}
                onPress={() => router.push('/create-party')}
              >
                <Text style={styles.hostPartyButtonText}>Host a Party</Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.listContainer}>
          <FlatList
            data={parties}
            keyExtractor={(item) => item.id}
            renderItem={renderPartyItem}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#ff5167" />
            }
            contentContainerStyle={styles.listContent}
          />
          
          {/* Floating Action Button (FAB) */}
          <TouchableOpacity
            style={styles.fab}
            activeOpacity={0.8}
            onPress={() => router.push('/create-party')}
          >
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </TouchableOpacity>
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#201f1f',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#e5e2e1',
    fontFamily: 'Inter',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#e6bcbd',
    fontFamily: 'Inter',
    marginTop: 4,
  },
  listContainer: {
    flex: 1,
    position: 'relative',
  },
  listContent: {
    paddingVertical: 20,
  },
  card: {
    backgroundColor: '#201f1f', // Level 1 Surface
    borderRadius: 24, // Radius 24px per DESIGN.md
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#e5e2e1',
    fontFamily: 'Inter',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoIcon: {
    marginRight: 8,
    width: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#e6bcbd',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 14,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hostContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 12,
  },
  hostAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  hostAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#353534',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hostLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#e6bcbd',
    fontFamily: 'Inter',
    letterSpacing: 1,
  },
  hostName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e5e2e1',
    fontFamily: 'Inter',
    marginTop: 2,
  },
  rsvpButton: {
    backgroundColor: '#ff5167', // Electric Pink Primary
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 9999, // Pill-shaped
    gap: 6,
    minWidth: 90,
  },
  rsvpButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    fontFamily: 'Inter',
  },
  joinedButton: {
    backgroundColor: 'transparent',
    borderColor: '#4b8eff', // Outlined border in Cyan
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9, // Slightly less due to border
    paddingHorizontal: 18,
    borderRadius: 9999, // Pill-shaped
    gap: 6,
  },
  joinedButtonText: {
    color: '#4b8eff',
    fontWeight: '800',
    fontSize: 13,
    fontFamily: 'Inter',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    color: '#e6bcbd',
    fontSize: 14,
    marginTop: 12,
    fontFamily: 'Inter',
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorText: {
    color: '#ff5167',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Inter',
  },
  retryButton: {
    backgroundColor: '#ff5167',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 9999,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    fontFamily: 'Inter',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#e5e2e1',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#e6bcbd',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    fontFamily: 'Inter',
  },
  hostPartyButton: {
    backgroundColor: '#ff5167',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 9999,
  },
  hostPartyButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    fontFamily: 'Inter',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ff5167',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff5167',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
