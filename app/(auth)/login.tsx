import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import TurnstileCaptcha from '@/components/TurnstileCaptcha';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';

const FAILED_LOGIN_KEY = 'failed_login_attempts';
const FAILED_LOGIN_THRESHOLD = 3;

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>('');

  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');
  const errorColor = useThemeColor({}, 'error');

  // Load failed login attempts on mount
  useEffect(() => {
    const loadFailedAttempts = async () => {
      try {
        const stored = await AsyncStorage.getItem(FAILED_LOGIN_KEY);
        if (stored) {
          const attempts = parseInt(stored, 10);
          setFailedAttempts(attempts);
          if (attempts >= FAILED_LOGIN_THRESHOLD) {
            setShowCaptcha(true);
          }
        }
      } catch (error) {
        console.error('Failed to load login attempts:', error);
      }
    };
    loadFailedAttempts();
  }, []);

  const incrementFailedAttempts = async () => {
    const newAttempts = failedAttempts + 1;
    setFailedAttempts(newAttempts);
    await AsyncStorage.setItem(FAILED_LOGIN_KEY, newAttempts.toString());
    
    if (newAttempts >= FAILED_LOGIN_THRESHOLD) {
      setShowCaptcha(true);
    }
  };

  const resetFailedAttempts = async () => {
    setFailedAttempts(0);
    await AsyncStorage.removeItem(FAILED_LOGIN_KEY);
    setShowCaptcha(false);
    setCaptchaToken('');
  };

  const handleLogin = async () => {
    setError('');

    if (!displayName.trim()) {
      setError('Please enter your display name.');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }

    // Require captcha if threshold reached
    if (failedAttempts >= FAILED_LOGIN_THRESHOLD && !captchaToken) {
      setError('Please complete the captcha verification.');
      return;
    }

    setIsLoading(true);
    try {
      await signIn(displayName.trim(), password, captchaToken);
      // Success - reset failed attempts
      await resetFailedAttempts();
      // Navigation will happen automatically via AuthContext state change
    } catch (e: any) {
      // Failed login - increment counter
      await incrementFailedAttempts();
      setError(e.message || 'Login failed. Please check your credentials.');
      // Reset captcha token so user must complete it again
      setCaptchaToken('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ThemedView style={styles.container}>
            <ThemedText type="title">RollTracks</ThemedText>
            <ThemedText style={styles.subtitle}>
              Log In
            </ThemedText>

            <ThemedView style={styles.formContainer}>
              <ThemedText style={styles.label}>Display Name</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: textColor, borderColor: iconColor },
                ]}
                placeholder="Enter your display name"
                placeholderTextColor={iconColor}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                editable={!isLoading}
              />

              <ThemedText style={styles.label}>Password</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: textColor, borderColor: iconColor },
                ]}
                placeholder="Enter your password"
                placeholderTextColor={iconColor}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                editable={!isLoading}
              />

              {/* Show captcha after 3 failed attempts */}
              {showCaptcha && (
                <>
                  <ThemedText style={styles.label}>Verification Required</ThemedText>
                  <ThemedText style={styles.captchaHint}>
                    Complete the verification to continue
                  </ThemedText>
                  <ThemedView style={styles.captchaContainer}>
                    <TurnstileCaptcha
                      siteKey={process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? ''}
                      appearance="always"
                      onSuccess={(token: string) => setCaptchaToken(token)}
                      onError={() => setError('Captcha verification failed. Please try again.')}
                      onExpire={() => setCaptchaToken('')}
                    />
                  </ThemedView>
                </>
              )}

              {error ? (
                <ThemedText style={[styles.error, { color: errorColor }]}>{error}</ThemedText>
              ) : null}

              {failedAttempts > 0 && failedAttempts < FAILED_LOGIN_THRESHOLD && (
                <ThemedText style={styles.warningText}>
                  {FAILED_LOGIN_THRESHOLD - failedAttempts} attempt{FAILED_LOGIN_THRESHOLD - failedAttempts !== 1 ? 's' : ''} remaining before verification required
                </ThemedText>
              )}

              <TouchableOpacity
                style={[styles.button, { backgroundColor: tintColor }]}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.7}
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

            <Link href="/(auth)/create-profile" asChild>
              <TouchableOpacity style={styles.link} activeOpacity={0.7}>
                <ThemedText type="link">Create a new account</ThemedText>
              </TouchableOpacity>
            </Link>
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    minHeight: 600,
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
    backgroundColor: 'transparent',
  },
  captchaHint: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 8,
  },
  captchaContainer: {
    marginVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  error: {
    marginTop: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  warningText: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 48,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    marginTop: 20,
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
});
