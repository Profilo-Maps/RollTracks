import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Link } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');
  const errorColor = useThemeColor({}, 'error');

  const handleLogin = async () => {
    setError('');

    if (!username.trim()) {
      setError('Please enter your username.');
      return;
    }
    if (!pin.trim()) {
      setError('Please enter your PIN.');
      return;
    }

    setIsLoading(true);
    try {
      await signIn(username.trim(), pin);
    } catch (e: any) {
      setError(e.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ThemedView style={styles.container}>
        <ThemedText type="title">RollTracks</ThemedText>
        <ThemedText style={styles.subtitle}>
          Privacy-first route sharing
        </ThemedText>

        <ThemedView style={styles.formContainer}>
          <ThemedText style={styles.label}>Username</ThemedText>
          <TextInput
            style={[
              styles.input,
              { color: textColor, borderColor: iconColor },
            ]}
            placeholder="Enter your username"
            placeholderTextColor={iconColor}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <ThemedText style={styles.label}>PIN</ThemedText>
          <TextInput
            style={[
              styles.input,
              { color: textColor, borderColor: iconColor },
            ]}
            placeholder="Enter your PIN"
            placeholderTextColor={iconColor}
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          {error ? (
            <ThemedText style={[styles.error, { color: errorColor }]}>{error}</ThemedText>
          ) : null}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: tintColor }]}
            onPress={handleLogin}
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
                Log In
              </ThemedText>
            )}
          </TouchableOpacity>
        </ThemedView>

        <Link href="/(auth)/create-profile" style={styles.link}>
          <ThemedText type="link">Create a new account</ThemedText>
        </Link>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 40,
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
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  error: {
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
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
