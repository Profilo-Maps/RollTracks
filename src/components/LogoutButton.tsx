import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../hooks';

interface LogoutButtonProps {
  style?: any;
  textStyle?: any;
}

export const LogoutButton: React.FC<LogoutButtonProps> = ({ style, textStyle }) => {
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await signOut();
              // Navigation to login screen will be handled by auth state change
            } catch (error) {
              Alert.alert('Error', 'Failed to logout. Please try again.');
              setLoading(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={handleLogout}
      disabled={loading}
      accessibilityLabel="Logout"
      accessibilityRole="button"
      accessibilityHint="Tap to sign out of your account. You will be asked to confirm."
      accessibilityState={{ disabled: loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color="#e74c3c" size="small" accessibilityLabel="Logging out" />
      ) : (
        <Text style={[styles.buttonText, textStyle]}>Logout</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e74c3c',
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '600',
  },
});
