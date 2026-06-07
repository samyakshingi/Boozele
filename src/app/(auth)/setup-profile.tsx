import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/utils/supabase';

const DRINK_TAGS = [
  'Craft Beer',
  'Wine',
  'Cocktails',
  'Whiskey',
  'Tequila',
  'Sober-Curious',
  'Sake',
  'Cider',
];

export default function SetupProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // States for user input
  const [images, setImages] = useState<(string | null)[]>([null, null, null, null]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [intents, setIntents] = useState<string[]>([]); // '1-on-1', 'group'

  useEffect(() => {
    // Retrieve current session/user
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      } else {
        Alert.alert('Session Expired', 'Please sign in again.');
        router.replace('/login');
      }
    };
    checkUser();
  }, [router]);

  // Handle image picking using expo-image-picker
  const pickImage = async (index: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permissions to upload profile photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const newImages = [...images];
      newImages[index] = result.assets[0].uri;
      setImages(newImages);
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages[index] = null;
    setImages(newImages);
  };

  // Toggle drink preferences tags
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // Toggle intents
  const toggleIntent = (intent: string) => {
    if (intents.includes(intent)) {
      setIntents(intents.filter((i) => i !== intent));
    } else {
      setIntents([...intents, intent]);
    }
  };

  // Upload image to Supabase Storage
  const uploadImageToStorage = async (uri: string, index: number, uId: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const fileExt = uri.split('.').pop() || 'jpg';
    const fileName = `photo_${index}_${Date.now()}.${fileExt}`;
    const filePath = `${uId}/${fileName}`;

    const { error } = await supabase.storage
      .from('avatars')
      .upload(filePath, blob, {
        contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
        upsert: true,
      });

    if (error) {
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  // Save profile state to Supabase
  const handleSaveProfile = async () => {
    const selectedPhotos = images.filter((img) => img !== null) as string[];
    
    if (selectedPhotos.length < 2) {
      Alert.alert('Photos Required', 'Please select at least 2 profile photos.');
      return;
    }

    if (selectedTags.length === 0) {
      Alert.alert('Drink DNA Required', 'Please select at least 1 drink preference.');
      return;
    }

    if (intents.length === 0) {
      Alert.alert('Intent Required', 'Please select at least 1 social intent toggle.');
      return;
    }

    if (!userId) return;

    setLoading(true);

    try {
      // 1. Upload photos to Storage
      const uploadPromises = selectedPhotos.map((uri, idx) => 
        uploadImageToStorage(uri, idx, userId)
      );
      const publicUrls = await Promise.all(uploadPromises);

      // 2. Update profiles record in Database
      const { error } = await supabase
        .from('profiles')
        .update({
          avatar_urls: publicUrls,
          drink_preferences: selectedTags,
          intents: intents,
        })
        .eq('id', userId);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        // 3. Route to main tab system
        router.replace('/');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred while uploading.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Set Up Profile</Text>
          <Text style={styles.subtitle}>Complete your profile to find your nightlife buddies.</Text>
        </View>

        {/* 2x2 Photo Grid */}
        <Text style={styles.sectionTitle}>Profile Photos (Min 2)</Text>
        <View style={styles.photoGrid}>
          {images.map((uri, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.photoBox}
              activeOpacity={0.8}
              onPress={() => (uri ? removeImage(idx) : pickImage(idx))}
            >
              {uri ? (
                <View style={styles.imageWrapper}>
                  <Image source={{ uri }} style={styles.image} />
                  <View style={styles.deleteOverlay}>
                    <Text style={styles.deleteText}>✕</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.addWrapper}>
                  <Text style={styles.addPlus}>+</Text>
                  <Text style={styles.addLabel}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Drink DNA Selection */}
        <Text style={styles.sectionTitle}>My Drink DNA</Text>
        <Text style={styles.sectionSubtitle}>Select the drinks you enjoy when going out.</Text>
        <View style={styles.tagContainer}>
          {DRINK_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                style={[styles.tag, isSelected && styles.tagSelected]}
                onPress={() => toggleTag(tag)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Intent Toggles */}
        <Text style={styles.sectionTitle}>{"I'm Looking For"}</Text>
        <Text style={styles.sectionSubtitle}>Toggle your social preferences.</Text>
        <View style={styles.intentContainer}>
          <TouchableOpacity
            style={[styles.intentBox, intents.includes('1-on-1') && styles.intentBoxSelected]}
            onPress={() => toggleIntent('1-on-1')}
            activeOpacity={0.8}
          >
            <Text style={styles.intentIcon}>🥂</Text>
            <Text style={[styles.intentTitle, intents.includes('1-on-1') && styles.intentTitleSelected]}>
              1-on-1 Chill Drinks
            </Text>
            <Text style={styles.intentDesc}>Find a buddy to grab casual drinks with.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.intentBox, intents.includes('group') && styles.intentBoxSelected]}
            onPress={() => toggleIntent('group')}
            activeOpacity={0.8}
          >
            <Text style={styles.intentIcon}>🎉</Text>
            <Text style={[styles.intentTitle, intents.includes('group') && styles.intentTitleSelected]}>
              Big Group Parties
            </Text>
            <Text style={styles.intentDesc}>Host or join house parties & pub crawls.</Text>
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSaveProfile}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Profile</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const screenWidth = Dimensions.get('window').width;
const boxSize = (screenWidth - 48 - 16) / 2;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#131313', // Level 0 Background per DESIGN.md
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  headerContainer: {
    marginBottom: 28,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#e5e2e1', // on-surface text
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#e6bcbd', // on-surface-variant text
    fontFamily: 'Inter',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e5e2e1',
    fontFamily: 'Inter',
    marginTop: 24,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#e6bcbd',
    fontFamily: 'Inter',
    marginBottom: 16,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  photoBox: {
    width: boxSize,
    height: boxSize,
    borderRadius: 24, // High container radius per DESIGN.md
    backgroundColor: '#201f1f', // Level 1 Card Background
    borderColor: '#353534',
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageWrapper: {
    flex: 1,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  deleteOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(19, 19, 19, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 0.5,
  },
  deleteText: {
    color: '#e5e2e1',
    fontSize: 12,
    fontWeight: 'bold',
  },
  addWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  addPlus: {
    fontSize: 32,
    color: '#ffb3b5', // primary muted color
    fontWeight: '300',
    marginBottom: 6,
  },
  addLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e6bcbd',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999, // Pill-shaped per DESIGN.md
    borderWidth: 1,
    borderColor: '#353534', // Dark grey stroke
    backgroundColor: 'transparent',
  },
  tagSelected: {
    backgroundColor: '#fecb00', // Active solid secondary Amber per DESIGN.md
    borderColor: '#fecb00',
  },
  tagText: {
    fontSize: 14,
    color: '#e5e2e1',
    fontFamily: 'Inter',
  },
  tagTextSelected: {
    color: '#131313', // Contrast text on Amber
    fontWeight: '700',
  },
  intentContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  intentBox: {
    flex: 1,
    backgroundColor: '#201f1f',
    borderColor: '#353534',
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
  },
  intentBoxSelected: {
    borderColor: '#ff5167', // Primary Pink outline
    borderWidth: 2,
    // Soft neon backglow
    shadowColor: '#ff5167',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  intentIcon: {
    fontSize: 28,
    marginBottom: 10,
  },
  intentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e5e2e1',
    fontFamily: 'Inter',
    marginBottom: 4,
    textAlign: 'center',
  },
  intentTitleSelected: {
    color: '#ff5167',
  },
  intentDesc: {
    fontSize: 11,
    color: '#e6bcbd',
    textAlign: 'center',
    lineHeight: 15,
  },
  saveButton: {
    backgroundColor: '#ff5167', // Primary Pink per DESIGN.md
    borderRadius: 9999, // Pill-shaped
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#ff5167',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
    height: 52,
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#5d3f40', // outline-variant
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
});
