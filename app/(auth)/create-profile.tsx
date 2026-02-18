import { Link } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
    TouchableOpacity,
} from 'react-native';

import SelectModeListComponent from '@/components/SelectModeListComponent';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import TurnstileCaptcha from '@/components/TurnstileCaptcha';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { errorNotification, mediumImpact, selectionFeedback } from '@/utils/haptics';

export default function CreateProfileScreen() {
  const { signUp, checkDisplayNameAvailability } = useAuth();
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme];
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [modeList, setModeList] = useState<string[]>([]);
  const [dataRangerMode, setDataRangerMode] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [displayNameStatus, setDisplayNameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');
  const errorColor = useThemeColor({}, 'error');

  // Debounced display name availability check
  const checkDisplayName = async (name: string) => {
    if (!name.trim() || name.length < 3) {
      setDisplayNameStatus('idle');
      return;
    }

    setDisplayNameStatus('checking');
    try {
      const isAvailable = await checkDisplayNameAvailability(name.trim());
      setDisplayNameStatus(isAvailable ? 'available' : 'taken');
    } catch (error) {
      console.error('Failed to check display name:', error);
      setDisplayNameStatus('idle');
    }
  };

  // Debounce the check
  const handleDisplayNameChange = (text: string) => {
    setDisplayName(text);
    setDisplayNameStatus('idle');
    
    // Clear any existing timeout
    if ((handleDisplayNameChange as any).timeout) {
      clearTimeout((handleDisplayNameChange as any).timeout);
    }
    
    // Set new timeout
    (handleDisplayNameChange as any).timeout = setTimeout(() => {
      checkDisplayName(text);
    }, 500);
  };

  const handleSignUp = async () => {
    setError('');

    if (!displayName.trim()) {
      errorNotification();
      setError('Please enter a display name.');
      return;
    }

    if (displayName.trim().length < 3) {
      errorNotification();
      setError('Display name must be at least 3 characters.');
      return;
    }

    if (displayNameStatus === 'taken') {
      errorNotification();
      setError('This display name is already taken. Please choose a different one.');
      return;
    }

    const ageNum = parseInt(age, 10);
    if (!age.trim() || isNaN(ageNum)) {
      errorNotification();
      setError('Please enter a valid age.');
      return;
    }
    if (ageNum < 18) {
      errorNotification();
      setError('You must be at least 18 years old.');
      return;
    }

    if (!password) {
      errorNotification();
      setError('Please enter a password.');
      return;
    }
    if (password !== confirmPassword) {
      errorNotification();
      setError('Passwords do not match.');
      return;
    }

    if (modeList.length === 0) {
      errorNotification();
      setError('Please select at least one travel mode.');
      return;
    }

    if (!captchaToken) {
      errorNotification();
      setError('Please complete the captcha verification.');
      return;
    }

    setIsLoading(true);
    try {
      console.log('About to call signUp with:', {
        displayName: displayName.trim(),
        age: ageNum,
        modeList,
        passwordType: typeof password,
        passwordLength: password?.length,
        captchaToken,
      });
      
      await signUp({
        displayName: displayName.trim(),
        age: ageNum,
        modeList,
        dataRangerMode,
        password,
        captchaToken,
      });
      
      // Navigation will happen automatically via AuthContext state change
    } catch (e: any) {
      errorNotification();
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
            <ThemedText style={styles.label}>Display Name</ThemedText>
            <ThemedText style={styles.warning}>
              Please do not use identifying information in your display name.
            </ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="Choose a display name"
              placeholderTextColor={iconColor}
              value={displayName}
              onChangeText={handleDisplayNameChange}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
            {displayNameStatus === 'checking' && (
              <ThemedText style={[styles.hint, { color: iconColor }]}>
                Checking availability...
              </ThemedText>
            )}
            {displayNameStatus === 'available' && (
              <ThemedText style={[styles.hint, { color: tintColor }]}>
                ✓ Display name is available
              </ThemedText>
            )}
            {displayNameStatus === 'taken' && (
              <ThemedText style={[styles.hint, { color: errorColor }]}>
                ✗ This display name is already taken
              </ThemedText>
            )}

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
              autoCapitalize="none"
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
              autoCapitalize="none"
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

            <ThemedView style={styles.switchContainer}>
              <ThemedView style={styles.switchLabelContainer}>
                <ThemedText style={styles.label}>DataRanger Mode</ThemedText>
                <ThemedText style={styles.hint}>
                  Enable advanced features to assess and update urban infrastructure data (curb ramps, sidewalk networks). You can change this anytime from your profile.
                </ThemedText>
              </ThemedView>
              <Switch
                value={dataRangerMode}
                onValueChange={(value) => {
                  selectionFeedback();
                  setDataRangerMode(value);
                }}
                trackColor={{ false: iconColor, true: tintColor }}
                thumbColor="#fff"
              />
            </ThemedView>

            {showCaptcha && (
              <>
                <ThemedText style={styles.label}>Verification</ThemedText>
                <ThemedView style={styles.captchaContainer}>
                  <TurnstileCaptcha
                    siteKey={process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? ''}
                    appearance="always"
                    onSuccess={(token: string) => {
                      setCaptchaToken(token);
                      setShowCaptcha(false);
                    }}
                    onError={() => setError('Captcha verification failed. Please try again.')}
                    onExpire={() => setCaptchaToken('')}
                  />
                </ThemedView>
              </>
            )}

            {/* Hidden captcha for invisible mode */}
            {!showCaptcha && (
              <ThemedView style={styles.hiddenCaptcha}>
                <TurnstileCaptcha
                  siteKey={process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? ''}
                  appearance="execute"
                  onSuccess={(token: string) => setCaptchaToken(token)}
                  onError={() => {
                    setShowCaptcha(true);
                    setError('Please complete the verification challenge.');
                  }}
                  onExpire={() => setCaptchaToken('')}
                />
              </ThemedView>
            )}

            {error ? (
              <ThemedText style={[styles.error, { color: errorColor }]}>{error}</ThemedText>
            ) : null}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: tintColor }]}
              onPress={() => {
                mediumImpact();
                handleSignUp();
              }}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText
                  style={[styles.buttonText, { color: colors.tintButtonText }]}
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
    fontWeight: '800',
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
  captchaContainer: {
    marginVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  hiddenCaptcha: {
    height: 0,
    width: 0,
    overflow: 'hidden',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: Fonts.regular,
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
    fontWeight: '800',
  },
  link: {
    marginTop: 20,
    paddingVertical: 15,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 12,
  },
});
