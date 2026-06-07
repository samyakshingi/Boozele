import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface Plan {
  id: string;
  host_id: string;
  conversation_id: string;
  title: string;
  event_time: string;
  venue: string | null;
  menu: string | null;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); // conversation_id
  const router = useRouter();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [inputText, setInputText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [buddyId, setBuddyId] = useState<string | null>(null);
  const [buddyUsername, setBuddyUsername] = useState('Chat');
  const [sending, setSending] = useState(false);

  // Plan states
  const [plan, setPlan] = useState<Plan | null>(null);
  const [isEditingVenue, setIsEditingVenue] = useState(false);
  const [isEditingMenu, setIsEditingMenu] = useState(false);
  const [editedVenueText, setEditedVenueText] = useState('');
  const [editedMenuText, setEditedMenuText] = useState('');

  useEffect(() => {
    let isMounted = true;
    let channel: any = null;

    const setupChat = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!isMounted) return;
        if (!user) {
          router.replace('/login');
          return;
        }
        setCurrentUserId(user.id);

        // 1. Fetch Buddy profile details for this conversation thread
        const { data: members, error: membersError } = await supabase
          .from('conversation_members')
          .select('user_id, profiles(username)')
          .eq('conversation_id', id);

        if (!isMounted) return;

        if (!membersError && members) {
          const buddy = members.find((m: any) => m.user_id !== user.id);
          if (buddy) {
            setBuddyId(buddy.user_id);
            if (buddy.profiles) {
              setBuddyUsername((buddy.profiles as any).username);
            }
          }
        }

        // 2. Fetch Historical Messages (ordered by created_at DESC for inverted FlatList)
        const { data: msgs, error: msgsError } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', id)
          .order('created_at', { ascending: false });

        if (!isMounted) return;

        if (msgsError) {
          setErrorMsg(msgsError.message);
        } else if (msgs) {
          setMessages(msgs);
        }

        // 2b. Fetch active plan for this conversation
        const { data: planData, error: planError } = await supabase
          .from('plans')
          .select('*')
          .eq('conversation_id', id)
          .maybeSingle();

        if (!isMounted) return;

        if (!planError && planData) {
          setPlan(planData);
          setEditedVenueText(planData.venue || '');
          setEditedMenuText(planData.menu || '');
        }

        // 3. Initialize Realtime Postgres subscription
        const subChannel = supabase
          .channel(`room:${id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${id}`,
            },
            (payload) => {
              if (!isMounted) return;
              const newMsg = payload.new as Message;
              // Add to local state instantly
              setMessages((prev) => {
                // Prevent duplicate inserts if the sender already added it locally
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [newMsg, ...prev];
              });
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'plans',
              filter: `conversation_id=eq.${id}`,
            },
            (payload) => {
              if (!isMounted) return;
              const updatedPlan = payload.new as Plan;
              setPlan(updatedPlan);
              setEditedVenueText(updatedPlan.venue || '');
              setEditedMenuText(updatedPlan.menu || '');
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'plans',
              filter: `conversation_id=eq.${id}`,
            },
            (payload) => {
              if (!isMounted) return;
              const newPlan = payload.new as Plan;
              setPlan(newPlan);
              setEditedVenueText(newPlan.venue || '');
              setEditedMenuText(newPlan.menu || '');
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED' && !isMounted) {
              supabase.removeChannel(subChannel);
            }
          });
        channel = subChannel;

      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(err.message || 'An error occurred setting up chat.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    setupChat();

    // 4. Cleanup: Unsubscribe on unmount to prevent memory leaks
    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [id, router]);

  const handleOptionsPress = () => {
    Alert.alert(
      'Safety Options',
      'Choose an action to take for this buddy.',
      [
        {
          text: 'Unmatch',
          onPress: confirmUnmatch,
          style: 'destructive',
        },
        {
          text: 'Block User',
          onPress: confirmBlock,
          style: 'destructive',
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const confirmUnmatch = () => {
    Alert.alert(
      'Unmatch Buddy?',
      'Are you sure you want to unmatch? This action is permanent and will delete your chat history.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unmatch', style: 'destructive', onPress: handleUnmatch },
      ]
    );
  };

  const confirmBlock = () => {
    Alert.alert(
      'Block Buddy?',
      'Are you sure you want to block this user? This action is permanent, they will be blocked, and your chat history will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: handleBlock },
      ]
    );
  };

  const handleSuggestPlan = async () => {
    if (!currentUserId || !id) return;
    try {
      const defaultTime = new Date();
      defaultTime.setHours(defaultTime.getHours() + 2); // 2 hours from now

      const { data, error } = await supabase
        .from('plans')
        .insert({
          host_id: currentUserId,
          conversation_id: id,
          title: "Tonight's Drinks",
          event_time: defaultTime.toISOString(),
          venue: '',
          menu: '',
        })
        .select()
        .single();

      if (error) {
        Alert.alert('Failed to Suggest Plan', error.message);
      } else if (data) {
        setPlan(data);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleUpdateVenue = async () => {
    if (!plan || !id) return;
    try {
      const { error } = await supabase
        .from('plans')
        .update({ venue: editedVenueText.trim() })
        .eq('id', plan.id);

      if (error) {
        Alert.alert('Update Failed', error.message);
      } else {
        setIsEditingVenue(false);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleUpdateMenu = async () => {
    if (!plan || !id) return;
    try {
      const { error } = await supabase
        .from('plans')
        .update({ menu: editedMenuText.trim() })
        .eq('id', plan.id);

      if (error) {
        Alert.alert('Update Failed', error.message);
      } else {
        setIsEditingMenu(false);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleUnmatch = async () => {
    if (!currentUserId || !buddyId || !id) return;
    setLoading(true);
    try {
      const firstId = currentUserId < buddyId ? currentUserId : buddyId;
      const secondId = currentUserId < buddyId ? buddyId : currentUserId;

      // 1. Delete buddy relationship
      const { error: buddyError } = await supabase
        .from('buddies')
        .delete()
        .eq('user_id_1', firstId)
        .eq('user_id_2', secondId);

      if (buddyError) throw buddyError;

      // 2. Delete the entire conversation record to wipe chat history for both users
      const { error: convoError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', id);

      if (convoError) throw convoError;

      // 3. Eject user and route back to buddies tab
      router.replace('/(tabs)/buddies');
    } catch (err: any) {
      Alert.alert('Action Failed', err.message || 'An error occurred during unmatch.');
      setLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!currentUserId || !buddyId || !id) return;
    setLoading(true);
    try {
      const firstId = currentUserId < buddyId ? currentUserId : buddyId;
      const secondId = currentUserId < buddyId ? buddyId : currentUserId;

      // 1. Update buddy relationship status to 'blocked'
      const { error: buddyError } = await supabase
        .from('buddies')
        .update({ status: 'blocked' })
        .eq('user_id_1', firstId)
        .eq('user_id_2', secondId);

      if (buddyError) throw buddyError;

      // 2. Delete the entire conversation record to wipe chat history for both users
      const { error: convoError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', id);

      if (convoError) throw convoError;

      // 3. Eject user and route back to buddies tab
      router.replace('/(tabs)/buddies');
    } catch (err: any) {
      Alert.alert('Action Failed', err.message || 'An error occurred during blocking.');
      setLoading(false);
    }
  };

  // Send message insert logic
  const handleSendMessage = async () => {
    if (!inputText.trim() || !currentUserId || !id) return;
    
    const messageContent = inputText.trim();
    setInputText('');
    setSending(true);

    // Optimistic UI update for fluid animations
    const tempId = Math.random().toString();
    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: id,
      sender_id: currentUserId,
      content: messageContent,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [optimisticMessage, ...prev]);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: id,
          sender_id: currentUserId,
          content: messageContent,
        })
        .select()
        .single();

      if (error) {
        // Remove optimistic message and alert on failure
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        Alert.alert('Send Failure', error.message);
      } else if (data) {
        // Swap optimistic message with official db record
        setMessages((prev) => 
          prev.map((m) => (m.id === tempId ? data : m))
        );
      }
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isCurrentUser = item.sender_id === currentUserId;
    return (
      <View style={[styles.messageRow, isCurrentUser ? styles.rowRight : styles.rowLeft]}>
        <View
          style={[
            styles.messageBubble,
            isCurrentUser ? styles.bubbleRight : styles.bubbleLeft,
          ]}
        >
          <Text style={[styles.messageText, isCurrentUser ? styles.textRight : styles.textLeft]}>
            {item.content}
          </Text>
        </View>
        <Text style={styles.timeText}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#e5e2e1" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{buddyUsername}</Text>
          {!plan && (
            <TouchableOpacity onPress={handleSuggestPlan} activeOpacity={0.7}>
              <Text style={styles.suggestPlanText}>Suggest Plan</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.optionsButton} onPress={handleOptionsPress}>
          <Ionicons name="shield-outline" size={24} color="#ff5167" />
        </TouchableOpacity>
      </View>

      {/* Collaborative Plan Canvas */}
      {plan ? (
        <View style={styles.canvasContainer}>
          <View style={styles.canvasHeader}>
            <Ionicons name="calendar" size={16} color="#ff5167" />
            <Text style={styles.canvasTitle}>{plan.title || 'Hangout Plan'}</Text>
          </View>

          <View style={styles.canvasFieldsRow}>
            {/* Venue Field */}
            <View style={styles.canvasFieldBox}>
              <Text style={styles.canvasFieldLabel}>VENUE</Text>
              {isEditingVenue ? (
                <View style={styles.editFieldInputContainer}>
                  <TextInput
                    style={styles.canvasTextInput}
                    value={editedVenueText}
                    onChangeText={setEditedVenueText}
                    placeholder="Enter venue..."
                    placeholderTextColor="#e6bcbd"
                    maxLength={100}
                    autoFocus
                  />
                  <TouchableOpacity style={styles.saveFieldButton} onPress={handleUpdateVenue}>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.displayFieldButton}
                  onPress={() => setIsEditingVenue(true)}
                  activeOpacity={0.7}
                >
                  <Text style={plan.venue ? styles.canvasValueText : styles.canvasPlaceholderText} numberOfLines={1}>
                    {plan.venue || 'Tap to suggest venue...'}
                  </Text>
                  <Ionicons name="create-outline" size={14} color="#e6bcbd" style={styles.editIcon} />
                </TouchableOpacity>
              )}
            </View>

            {/* Menu Field */}
            <View style={styles.canvasFieldBox}>
              <Text style={styles.canvasFieldLabel}>DRINK MENU</Text>
              {isEditingMenu ? (
                <View style={styles.editFieldInputContainer}>
                  <TextInput
                    style={styles.canvasTextInput}
                    value={editedMenuText}
                    onChangeText={setEditedMenuText}
                    placeholder="Enter menu..."
                    placeholderTextColor="#e6bcbd"
                    maxLength={100}
                    autoFocus
                  />
                  <TouchableOpacity style={styles.saveFieldButton} onPress={handleUpdateMenu}>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.displayFieldButton}
                  onPress={() => setIsEditingMenu(true)}
                  activeOpacity={0.7}
                >
                  <Text style={plan.menu ? styles.canvasValueText : styles.canvasPlaceholderText} numberOfLines={1}>
                    {plan.menu || 'Tap to suggest menu...'}
                  </Text>
                  <Ionicons name="create-outline" size={14} color="#e6bcbd" style={styles.editIcon} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      ) : null}

      {/* Loading & Messages FlatList */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color="#ff5167" size="large" />
        </View>
      ) : errorMsg ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          inverted // Inverted renders FlatList from bottom up
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Keyboard Input Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor="#e6bcbd"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#131313', // Level 0 background per DESIGN.md
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#201f1f',
    backgroundColor: '#131313',
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  suggestPlanText: {
    color: '#ff5167', // Primary Pink
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Inter',
    marginTop: 2,
    textDecorationLine: 'underline',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e5e2e1',
    fontFamily: 'Inter',
  },
  optionsButton: {
    padding: 4,
  },
  canvasContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)', // Glassmorphism container
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  canvasHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  canvasTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ff5167', // Primary Pink
    fontFamily: 'Inter',
    letterSpacing: 0.5,
  },
  canvasFieldsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  canvasFieldBox: {
    flex: 1,
    backgroundColor: '#1c1b1b', // Surface Container Low
    borderRadius: 12,
    padding: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  canvasFieldLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#e6bcbd', // on-surface-variant
    fontFamily: 'Inter',
    letterSpacing: 1,
    marginBottom: 4,
  },
  displayFieldButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 28,
  },
  canvasValueText: {
    fontSize: 13,
    color: '#e5e2e1', // on-surface
    fontFamily: 'Inter',
    fontWeight: '600',
    flex: 1,
    marginRight: 6,
  },
  canvasPlaceholderText: {
    fontSize: 12,
    color: '#5d3f40', // Muted outline
    fontFamily: 'Inter',
    fontStyle: 'italic',
    flex: 1,
  },
  editFieldInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  canvasTextInput: {
    flex: 1,
    fontSize: 13,
    color: '#e5e2e1',
    fontFamily: 'Inter',
    paddingVertical: 2,
    marginRight: 6,
  },
  saveFieldButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ff5167',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIcon: {
    marginLeft: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  messageRow: {
    maxWidth: '75%',
    marginBottom: 4,
  },
  rowRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  rowLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    elevation: 1,
  },
  bubbleRight: {
    backgroundColor: '#ff5167', // Primary Pink per DESIGN.md
    borderBottomRightRadius: 4,
    shadowColor: '#ff5167',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  bubbleLeft: {
    backgroundColor: '#201f1f', // Level 1 Surface per DESIGN.md
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: 'Inter',
  },
  textRight: {
    color: '#FFFFFF',
  },
  textLeft: {
    color: '#e5e2e1',
  },
  timeText: {
    fontSize: 10,
    color: '#e6bcbd',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#201f1f',
    backgroundColor: '#131313',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#201f1f', // Level 1 Surface
    borderColor: '#353534',
    borderWidth: 1,
    borderRadius: 24, // Pill shape
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#e5e2e1',
    fontFamily: 'Inter',
    fontSize: 15,
    maxHeight: 100,
    marginRight: 12,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ff5167', // Primary Pink
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff5167',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#5d3f40', // outline-variant
    shadowOpacity: 0,
    elevation: 0,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ff5167',
    fontFamily: 'Inter',
    fontSize: 14,
    textAlign: 'center',
  },
});
