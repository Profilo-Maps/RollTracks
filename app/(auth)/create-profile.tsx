import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import SelectModeListComponent from '@/components/SelectModeListComponent';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function CreateProfileScreen() {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [modeList, setModeList] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');
  const errorColor = useThemeColor({}, 'error');

  const handleSignUp = async () => {
    setError('');

    if (!displayName.trim()) {
      setError('Please enter a display name.');
      return;
    }

    const ageNum = parseInt(age, 10);
    if (!age.trim() || isNaN(ageNum)) {
      setError('Please enter a valid age.');
      return;
    }
    if (ageNum < 18) {
      setError('You must be at least 18 years old.');
      return;
    }

    if (!password) {
      setError('Please enter a password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (modeList.length === 0) {
      setError('Please select at least one travel mode.');
      return;
    }

    setIsLoading(true);
    try {
      await signUp({
        displayName: displayName.trim(),
        age: ageNum,
        modeList,
        dataRangerMode: false,
        password,
      });
    } catch (e: any) {
      setError(e.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = [
    styles.input,
    { color: textColor, borderColor: iconColor },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedView style={styles.container}>
          <ThemedText type="title">Create Profile</ThemedText>
          <ThemedText style={styles.subtitle}>Join the community</ThemedText>

          <ThemedView style={styles.formContainer}>
            <ThemedText style={styles.label}>Username</ThemedText>
            <ThemedText style={styles.warning}>
              Please do not use identifying information in your username.
            </ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="Choose a username"
              placeholderTextColor={iconColor}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <ThemedText style={styles.label}>Age</ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="Your age (18+)"
              placeholderTextColor={iconColor}
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              returnKeyType="next"
            />

            <ThemedText style={styles.label}>Password</ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="Create a password"
              placeholderTextColor={iconColor}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="next"
            />

            <ThemedText style={styles.label}>Confirm Password</ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="Confirm your password"
              placeholderTextColor={iconColor}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              returnKeyType="done"
            />

            <ThemedText style={styles.label}>Travel Modes</ThemedText>
            <ThemedText style={styles.hint}>
              Select all modes you use.
            </ThemedText>
            <SelectModeListComponent
              selected={modeList}
              onChange={setModeList}
            />

            {error ? (
              <ThemedText style={[styles.error, { color: errorColor }]}>{error}</ThemedText>
            ) : null}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: tintColor }]}
              onPress={handleSignUp}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText
                  style={styles.buttonText}
                  lightColor="#fff"
                  darkColor="#11181C"
                >
                  Create Account
                </ThemedText>
              )}
            </TouchableOpacity>
          </ThemedView>

          <Link href="/(auth)/login" style={styles.link}>
            <ThemedText type="link">Already have an account? Log in</ThemedText>
          </Link>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    paddingVertical: 60,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 32,
    opacity: 0.7,
  },
  formContainer: {
    width: '100%',
    maxWidth: 320,
  },
  label: {
    marginBottom: 6,
    fontWeight: '600',
  },
  warning: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  error: {
    marginTop: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    marginTop: 20,
    paddingVertical: 15,
  },
});
