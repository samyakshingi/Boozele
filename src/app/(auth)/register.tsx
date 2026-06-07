import React, { useState } from 'react';
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
import { supabase } from '@/utils/supabase';

// Helper function to validate 21+ age criteria strictly in TypeScript
export function validateAgeIs21OrOlder(dobString: string): boolean {
  const parts = dobString.split('-');
  if (parts.length !== 3) return false;
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Date months are 0-indexed
  const day = parseInt(parts[2], 10);
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  
  const dob = new Date(year, month, day);
  // Ensure the date is valid (i.e. did not wrap over to next month due to invalid days)
  if (dob.getFullYear() !== year || dob.getMonth() !== month || dob.getDate() !== day) {
    return false;
  }
  
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 21;
}

export default function RegisterScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');
  const [acceptGuidelines, setAcceptGuidelines] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRegister = async () => {
    if (!username || !email || !password || !dob) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    if (!acceptGuidelines) {
      setErrorMsg('You must accept the safety guidelines.');
      return;
    }

    // DOB Format regex check (YYYY-MM-DD)
    const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dobRegex.test(dob)) {
      setErrorMsg('Date of birth must be in YYYY-MM-DD format.');
      return;
    }

    // Frontend Age Gate verification
    const isAdult = validateAgeIs21OrOlder(dob);
    if (!isAdult) {
      setErrorMsg('Access Denied. You must be 21 years or older to register.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            date_of_birth: dob,
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg('Registration successful! Please check your email for verification.');
        // Clear fields
        setUsername('');
        setEmail('');
        setPassword('');
        setDob('');
        setAcceptGuidelines(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred during signup.');
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
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Header */}
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Enter your details. Access requires confirming you are 21 or older.</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
            {successMsg ? <Text style={styles.successText}>{successMsg}</Text> : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder="Choose a username"
                placeholderTextColor="#e6bcbd"
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#e6bcbd"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Choose a strong password"
                placeholderTextColor="#e6bcbd"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date of Birth</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#e6bcbd"
                keyboardType="numeric"
                maxLength={10}
                value={dob}
                editable={!loading}
                onChangeText={(text) => {
                  let formatted = text.replace(/[^0-9-]/g, '');
                  if (formatted.length === 4 && dob.length === 3) formatted += '-';
                  if (formatted.length === 7 && dob.length === 6) formatted += '-';
                  setDob(formatted);
                }}
              />
              <Text style={styles.hintText}>Strict 21+ verification is enforced on registration.</Text>
            </View>

            {/* Click-wrap Liability Acceptance */}
            <TouchableOpacity 
              style={styles.checkboxContainer}
              activeOpacity={0.8}
              onPress={() => !loading && setAcceptGuidelines(!acceptGuidelines)}
              disabled={loading}
            >
              <View style={[styles.checkbox, acceptGuidelines && styles.checkboxActive]}>
                {acceptGuidelines && <Text style={styles.checkboxCheck}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>
                I accept the <Text style={styles.guidelinesLink}>Liability & Safety Guidelines</Text>, confirming I will drink responsibly.
              </Text>
            </TouchableOpacity>

            {/* Actions */}
            <TouchableOpacity 
              style={[styles.button, (!acceptGuidelines || !username || !email || !password || !dob || loading) && styles.buttonDisabled]} 
              activeOpacity={0.8} 
              onPress={handleRegister}
              disabled={!acceptGuidelines || !username || !email || !password || !dob || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.linkButton} 
              activeOpacity={0.7}
              onPress={() => router.push('/login')}
              disabled={loading}
            >
              <Text style={styles.linkText}>Already have an account? Sign In</Text>
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
    backgroundColor: '#131313',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  headerContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#e6bcbd',
    lineHeight: 20,
  },
  formContainer: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e6bcbd',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1c1b1b',
    borderColor: '#5d3f40',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
  },
  hintText: {
    fontSize: 12,
    color: '#e6bcbd',
    marginTop: 6,
    fontStyle: 'italic',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 28,
    marginTop: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderColor: '#5d3f40',
    borderWidth: 2,
    borderRadius: 6,
    backgroundColor: '#1c1b1b',
    marginRight: 12,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#ff5167',
    borderColor: '#ff5167',
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: '#e6bcbd',
    lineHeight: 18,
  },
  guidelinesLink: {
    color: '#ff5167',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  button: {
    backgroundColor: '#ff5167',
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#ff5167',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    height: 52,
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#5d3f40',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  linkButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff5167',
  },
  errorText: {
    color: '#ff5167',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
  successText: {
    color: '#4CAF50',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
});
