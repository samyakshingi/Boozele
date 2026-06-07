import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';

interface Buddy {
  relationshipId: string;
  buddyId: string;
  username: string;
  avatarUrl: string | null;
  drinkPreferences: string[];
}

export default function BuddiesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [filteredBuddies, setFilteredBuddies] = useState<Buddy[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchBuddies = async () => {
    setErrorMsg('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('buddies')
        .select(`
          id,
          user_id_1,
          user_id_2,
          user1:profiles!user_id_1(username, avatar_urls, drink_preferences),
          user2:profiles!user_id_2(username, avatar_urls, drink_preferences)
        `)
        .eq('status', 'accepted')
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

      if (error) {
        setErrorMsg(error.message);
      } else if (data) {
        const mapped = data.map((row: any) => {
          const isUser1 = row.user_id_1 === user.id;
          const buddyProfile = isUser1 ? row.user2 : row.user1;
          const buddyId = isUser1 ? row.user_id_2 : row.user_id_1;
          return {
            relationshipId: row.id,
            buddyId,
            username: buddyProfile?.username || 'user_' + buddyId.substring(0, 8),
            avatarUrl: buddyProfile?.avatar_urls?.[0] || null,
            drinkPreferences: buddyProfile?.drink_preferences || [],
          };
        });
        setBuddies(mapped);
        setFilteredBuddies(mapped);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred fetching buddies.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBuddies();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBuddies();
  }, []);

  // Filter list locally based on search input
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setFilteredBuddies(buddies);
    } else {
      const query = text.toLowerCase();
      const filtered = buddies.filter((buddy) =>
        buddy.username.toLowerCase().includes(query)
      );
      setFilteredBuddies(filtered);
    }
  };

  const handleBuddyPress = async (buddy: Buddy) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: convoId, error } = await supabase.rpc('get_or_create_direct_conversation', {
        user_a: user.id,
        user_b: buddy.buddyId,
      });

      if (error) {
        setErrorMsg(error.message);
      } else if (convoId) {
        router.push(`/chat/${convoId}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const renderBuddyItem = ({ item }: { item: Buddy }) => {
    return (
      <TouchableOpacity
        style={styles.buddyCard}
        onPress={() => handleBuddyPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.avatarContainer}>
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {item.username.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {/* Active indicator (Cyan glow ring per DESIGN.md) */}
          <View style={styles.activeGlowRing} />
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.usernameText}>{item.username}</Text>
          <View style={styles.tagContainer}>
            {item.drinkPreferences.slice(0, 2).map((pref, index) => (
              <View key={index} style={styles.drinkTag}>
                <Text style={styles.drinkTagText}>{pref}</Text>
              </View>
            ))}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color="#e6bcbd" />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Search Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#e6bcbd" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search buddies..."
            placeholderTextColor="#e6bcbd"
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={18} color="#e6bcbd" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#ff2d55" size="large" />
        </View>
      ) : errorMsg ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchBuddies}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredBuddies.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="beer-outline" size={48} color="#e6bcbd" style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No buddies found' : 'No Buddies Yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'Try searching for a different username.'
              : 'Head over to Swipe discovery to make some connections!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredBuddies}
          keyExtractor={(item) => item.relationshipId}
          renderItem={renderBuddyItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#ff2d55"
              colors={['#ff2d55']}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#131313', // Level 0 Background per DESIGN.md
  },
  searchHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#131313',
    borderBottomWidth: 1,
    borderBottomColor: '#201f1f',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#201f1f', // Level 1 Card/Background
    borderRadius: 9999, // Pill shaped input per DESIGN.md
    paddingHorizontal: 16,
    height: 44,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#e5e2e1',
    fontFamily: 'Inter',
    fontSize: 14,
    paddingVertical: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buddyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#201f1f', // Level 1 Surface
    padding: 16,
    borderRadius: 24, // 24px container corner radius per DESIGN.md
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  avatarPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#353534',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#e5e2e1',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Inter',
  },
  activeGlowRing: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4b8eff', // Cyan tertiary per DESIGN.md
    borderColor: '#131313',
    borderWidth: 2,
  },
  infoContainer: {
    flex: 1,
  },
  usernameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e5e2e1', // Primary white
    fontFamily: 'Inter',
    marginBottom: 6,
  },
  tagContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  drinkTag: {
    backgroundColor: '#fecb00', // Amber secondary-container per DESIGN.md
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999, // Pill-shaped
  },
  drinkTagText: {
    fontSize: 11,
    color: '#131313', // Contrast dark text
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    color: '#ff2d55',
    fontFamily: 'Inter',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#ff2d55',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'Inter',
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e5e2e1',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#e6bcbd',
    textAlign: 'center',
    lineHeight: 18,
  },
});
