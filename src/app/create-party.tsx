import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';

export default function CreatePartyScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [venue, setVenue] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login');
      } else {
        setCurrentUser(user);
      }
    });
  }, [router]);

  const handleCreateParty = async () => {
    if (!title.trim() || !eventTime.trim() || !venue.trim()) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    if (!currentUser) return;

    // Validate Event Time Format (YYYY-MM-DD HH:MM)
    const timeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
    if (!timeRegex.test(eventTime)) {
      setErrorMsg('Event time must be in YYYY-MM-DD HH:MM format.');
      return;
    }

    // Parse date parts
    const parts = eventTime.split(' ');
    const dateStr = parts[0];
    const timeStr = parts[1];
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);

    const eventDate = new Date(year, month - 1, day, hour, minute);

    if (isNaN(eventDate.getTime())) {
      setErrorMsg('Please enter a valid date and time.');
      return;
    }

    if (eventDate <= new Date()) {
      setErrorMsg('Event time must be in the future.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // Create public party atomically via database RPC
      const { data: convoId, error } = await supabase.rpc('create_public_party', {
        party_title: title.trim(),
        party_event_time: eventDate.toISOString(),
        party_venue: venue.trim(),
      });

      if (error) throw error;

      // Navigate to the newly created group chat room
      router.replace(`/chat/${convoId}`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred while hosting the party.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#e5e2e1" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Host a Party</Text>
          <View style={{ width: 32 }} /> {/* balance the back button */}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formContainer}>
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            {/* Title Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>PARTY TITLE</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Friday Beer Crawl or Pre-Game Hangout"
                placeholderTextColor="#e6bcbd"
                maxLength={80}
                value={title}
                onChangeText={setTitle}
                editable={!loading}
              />
            </View>

            {/* Event Time Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>DATE & TIME</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD HH:MM (e.g. 2026-06-15 20:00)"
                placeholderTextColor="#e6bcbd"
                keyboardType="numeric"
                maxLength={16}
                value={eventTime}
                onChangeText={(text) => {
                  let formatted = text.replace(/[^0-9\s-:]/g, '');
                  if (formatted.length === 4 && eventTime.length === 3) formatted += '-';
                  if (formatted.length === 7 && eventTime.length === 6) formatted += '-';
                  if (formatted.length === 10 && eventTime.length === 9) formatted += ' ';
                  if (formatted.length === 13 && eventTime.length === 12) formatted += ':';
                  setEventTime(formatted);
                }}
                editable={!loading}
              />
              <Text style={styles.hintText}>Enter date and time in YYYY-MM-DD HH:MM format.</Text>
            </View>

            {/* Venue Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>VENUE / LOCATION</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Paddy's Pub or 123 Lounge St"
                placeholderTextColor="#e6bcbd"
                maxLength={100}
                value={venue}
                onChangeText={setVenue}
                editable={!loading}
              />
            </View>

            {/* Safety Disclaimer */}
            <View style={styles.disclaimerContainer}>
              <Ionicons name="shield-checkmark" size={18} color="#fecb00" style={styles.disclaimerIcon} />
              <Text style={styles.disclaimerText}>
                Boozele does not vet private residences. Always meet in public spaces first and drink responsibly.
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.button,
                (!title.trim() || !eventTime.trim() || !venue.trim() || loading) && styles.buttonDisabled,
              ]}
              activeOpacity={0.8}
              onPress={handleCreateParty}
              disabled={!title.trim() || !eventTime.trim() || !venue.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Host Event Now</Text>
                  <Ionicons name="beer-outline" size={16} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#131313', // Level 0 background
  },
  keyboardView: {
    flex: 1,
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
  },
  formContainer: {
    paddingHorizontal: 20,
  },
  errorText: {
    color: '#ff5167',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#e6bcbd', // on-surface-variant
    fontFamily: 'Inter',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1c1b1b', // Surface Container Low
    borderColor: '#5d3f40', // outline-variant
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#e5e2e1',
    fontSize: 15,
    fontFamily: 'Inter',
  },
  hintText: {
    fontSize: 11,
    color: '#e6bcbd',
    marginTop: 6,
    fontFamily: 'Inter',
  },
  disclaimerContainer: {
    backgroundColor: 'rgba(254, 203, 0, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(254, 203, 0, 0.2)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 32,
    gap: 12,
  },
  disclaimerIcon: {
    marginTop: 2,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#e6bcbd',
    fontFamily: 'Inter',
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#ff5167', // Electric Pink Primary
    borderRadius: 9999, // Pill-shaped
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
    backgroundColor: '#5d3f40', // outline-variant
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    fontFamily: 'Inter',
  },
});
