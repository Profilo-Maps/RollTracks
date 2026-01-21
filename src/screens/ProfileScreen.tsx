import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useServices } from '../contexts/ServicesContext';

import { ModeSelector } from '../components/ModeSelector';
import { ProfileStatistics } from '../components/ProfileStatistics';
import { UserProfile, Mode } from '../types';
import { Statistics } from '../services';
import { handleError } from '../utils/errors';

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, deleteAccount, updateProfile: updateUserProfile, signOut } = useAuth();
  const { showError, showSuccess } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form state
  const [age, setAge] = useState('');
  const [modeList, setModeList] = useState<Mode[]>([]);
  
  // Validation errors
  const [errors, setErrors] = useState<{
    age?: string;
    modeList?: string;
  }>({});

  // Get services from context
  const { profileService, statisticsService } = useServices();

  useEffect(() => {
    loadProfile();
  }, [user]);

  // Refresh statistics when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (profile && user && !isEditing) {
        refreshStatistics();
      }
    }, [profile, user, isEditing])
  );

  const refreshStatistics = async () => {
    if (!user) return;
    
    try {
      const stats = await statisticsService.getProfileStatistics(user.id);
      setStatistics(stats);
    } catch (error) {
      console.log('Could not refresh statistics:', error);
    }
  };

  const loadProfile = async () => {
    setLoading(true);
    try {
      // First check if user has profile data in AuthContext
      if (user?.age && user?.modeList && user.modeList.length > 0) {
        // User has profile data, populate form
        setAge(user.age.toString());
        setModeList(user.modeList as Mode[]);
        
        // Create a profile object for compatibility
        const userProfile: UserProfile = {
          id: user.id,
          user_id: user.id,
          age: user.age,
          mode_list: user.modeList as Mode[],
          trip_history_ids: user.tripHistoryIds || [],
          created_at: user.createdAt || new Date().toISOString(),
          updated_at: user.createdAt || new Date().toISOString(),
        };
        setProfile(userProfile);
        
        // Load statistics
        try {
          const stats = await statisticsService.getProfileStatistics(user.id);
          setStatistics(stats);
        } catch (statsError) {
          console.log('Could not load statistics:', statsError);
        }
      } else {
        // Check local storage as fallback
        const existingProfile = await profileService.getProfile();
        if (existingProfile) {
          setProfile(existingProfile);
          setAge(existingProfile.age.toString());
          setModeList(existingProfile.mode_list);
          
          // Load statistics
          const stats = await statisticsService.getProfileStatistics(existingProfile.id);
          setStatistics(stats);
        } else {
          // No profile exists, go to edit mode
          setIsEditing(true);
        }
      }
    } catch (error: any) {
      const appError = handleError(error);
      showError(appError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (profile) {
      // Reset form to profile values
      setAge(profile.age.toString());
      setModeList(profile.mode_list);
      setErrors({});
      setIsEditing(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { age?: string; modeList?: string } = {};
    
    // Validate age
    const ageNum = parseInt(age, 10);
    if (!age || isNaN(ageNum)) {
      newErrors.age = 'Age is required and must be a number';
    } else if (ageNum < 13 || ageNum > 120) {
      newErrors.age = 'Age must be between 13 and 120';
    }
    
    // Validate mode list
    if (modeList.length === 0) {
      newErrors.modeList = 'Please select at least one mode';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }
    
    setSaving(true);
    try {
      const profileData = {
        age: parseInt(age, 10),
        modeList: modeList,
      };
      
      // Update profile using AuthContext (updates user_accounts table)
      await updateUserProfile(profileData);
      
      // Also update local profile state for ProfileService compatibility
      if (profile) {
        await profileService.updateProfile({
          age: profileData.age,
          mode_list: profileData.modeList,
        });
      } else {
        await profileService.createProfile({
          user_id: user?.id || '',
          age: profileData.age,
          mode_list: profileData.modeList,
        });
      }
      
      showSuccess(profile ? 'Profile updated successfully' : 'Profile created successfully');
      
      // Reload profile and statistics
      const updatedProfile = await profileService.getProfile();
      setProfile(updatedProfile);
      
      if (updatedProfile) {
        const stats = await statisticsService.getProfileStatistics(updatedProfile.id);
        setStatistics(stats);
      }
      
      // Exit edit mode
      setIsEditing(false);
    } catch (error: any) {
      const appError = handleError(error);
      showError(appError.message);
    } finally {
      setSaving(false);
    }
  };

  const formatModeList = (modes: Mode[]): string => {
    return modes
      .map(mode => mode.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
      .join(', ');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This will permanently delete all your data including trips, ratings, and profile information. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              showSuccess('Account deleted successfully');
              // Navigation to login will be handled by auth state change
            } catch (error: any) {
              const appError = handleError(error);
              showError(appError.message);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'default',
          onPress: async () => {
            try {
              await signOut();
              showSuccess('Signed out successfully');
              // Navigation to login will be handled by auth state change
            } catch (error: any) {
              const appError = handleError(error);
              showError(appError.message);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // View mode - display profile with statistics
  if (profile && !isEditing) {
    return (
      <ScrollView 
        style={styles.container}
        accessible={false}
        accessibilityLabel="Profile screen"
      >
        
        <View style={styles.content}>
          <Text 
            style={styles.title}
            accessibilityRole="header"
            accessibilityLabel="Profile"
          >
            Profile
          </Text>
          
          <View style={styles.viewCard}>
            <TouchableOpacity
              style={styles.viewRow}
              onPress={handleEdit}
              accessibilityLabel="Age"
              accessibilityHint="Tap to edit your age"
              accessibilityRole="button"
            >
              <Text style={styles.viewLabel}>Age:</Text>
              <Text style={styles.viewValue}>{profile.age}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.viewRow}
              onPress={handleEdit}
              accessibilityLabel="Transportation modes"
              accessibilityHint="Tap to edit your transportation modes"
              accessibilityRole="button"
            >
              <Text style={styles.viewLabel}>Modes:</Text>
              <Text style={styles.viewValue}>{formatModeList(profile.mode_list)}</Text>
            </TouchableOpacity>
          </View>
          
          {statistics && <ProfileStatistics statistics={statistics} />}
          
          <TouchableOpacity
            style={styles.button}
            onPress={handleEdit}
            accessibilityLabel="Edit profile"
            accessibilityRole="button"
            accessibilityHint="Tap to edit your profile information"
          >
            <Text style={styles.buttonText}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleSignOut}
            accessibilityLabel="Sign out"
            accessibilityRole="button"
            accessibilityHint="Tap to sign out of your account"
          >
            <Text style={styles.buttonSecondaryText}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonDanger]}
            onPress={handleDeleteAccount}
            accessibilityLabel="Delete account"
            accessibilityRole="button"
            accessibilityHint="Tap to permanently delete your account and all data"
          >
            <Text style={styles.buttonDangerText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Edit/Create mode - show form
  return (
    <ScrollView 
      style={styles.container}
      accessible={false}
      accessibilityLabel="Profile screen"
    >
      
      <View style={styles.content}>
        <Text 
          style={styles.title}
          accessibilityRole="header"
          accessibilityLabel={profile ? 'Edit Profile' : 'Create Profile'}
        >
          {profile ? 'Edit Profile' : 'Create Profile'}
        </Text>
        
        <View style={styles.formGroup}>
          <Text 
            style={styles.label}
            accessibilityLabel="Age field, required"
          >
            Age *
          </Text>
          <TextInput
            style={[styles.input, errors.age && styles.inputError]}
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
            placeholder="Enter your age"
            placeholderTextColor="#999"
            accessibilityLabel="Age"
            accessibilityHint="Enter your age between 13 and 120. Required field."
          />
          {errors.age && (
            <Text 
              style={styles.errorText}
              accessibilityRole="alert"
            >
              {errors.age}
            </Text>
          )}
        </View>
        
        <View style={styles.formGroup}>
          <ModeSelector
            selectedModes={modeList}
            onSelectionChange={setModeList}
            label="Transportation Modes *"
            multiSelect={true}
          />
          {errors.modeList && (
            <Text 
              style={styles.errorText}
              accessibilityRole="alert"
            >
              {errors.modeList}
            </Text>
          )}
        </View>
        
        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
          accessibilityLabel={profile ? 'Update profile' : 'Create profile'}
          accessibilityRole="button"
          accessibilityHint={saving ? 'Saving profile' : 'Tap to save your profile information'}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" accessibilityLabel="Saving" />
          ) : (
            <Text style={styles.buttonText}>
              {profile ? 'Update Profile' : 'Create Profile'}
            </Text>
          )}
        </TouchableOpacity>
        
        {profile && (
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleCancelEdit}
            accessibilityLabel="Cancel editing"
            accessibilityRole="button"
            accessibilityHint="Tap to cancel editing and return to profile view"
          >
            <Text style={styles.buttonSecondaryText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#333',
  },
  viewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  viewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 44,
  },
  viewLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  viewValue: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    minHeight: 44,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 4,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    minHeight: 52,
    minWidth: 44,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  buttonSecondaryText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDanger: {
    backgroundColor: '#FF3B30',
  },
  buttonDangerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
