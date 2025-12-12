import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Trip, Mode } from '../types';

interface TripCardProps {
  trip: Trip;
}

const MODE_LABELS: Record<Mode, string> = {
  wheelchair: 'Wheelchair',
  assisted_walking: 'Assisted Walking',
  skateboard: 'Skateboard',
  scooter: 'Scooter',
  walking: 'Walking',
};

/**
 * TripCard component displays individual trip information
 * Shows start_time, end_time, duration, and route_info formatted for readability
 */
export const TripCard: React.FC<TripCardProps> = ({ trip }) => {
  const navigation = useNavigation();
  
  const handlePress = () => {
    // If trip is active or paused, navigate to ActiveTripScreen
    if (trip.status === 'active' || trip.status === 'paused') {
      (navigation as any).navigate('ActiveTrip', { tripId: trip.id });
    } 
    // If trip is completed, navigate to TripSummaryScreen
    else if (trip.status === 'completed') {
      (navigation as any).navigate('TripSummary', { trip });
    }
  };

  // Format timestamp for display
  const formatDateTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Format duration in seconds to readable format
  const formatDuration = (seconds: number | null): string => {
    if (seconds === null) return 'In Progress';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const modeLabel = MODE_LABELS[trip.mode] || trip.mode;
  const distanceText = trip.distance_miles !== null 
    ? `${trip.distance_miles.toFixed(2)} miles` 
    : 'N/A';

  const tripSummary = `Trip ${trip.status === 'completed' ? 'completed' : trip.status}. Mode: ${modeLabel}. Boldness: ${trip.boldness}. Distance: ${distanceText}. Started ${formatDateTime(trip.start_time)}. ${trip.end_time ? `Ended ${formatDateTime(trip.end_time)}.` : 'Still in progress.'} Duration: ${formatDuration(trip.duration_seconds)}.`;

  const isClickable = trip.status === 'active' || trip.status === 'paused' || trip.status === 'completed';
  const CardWrapper = isClickable ? TouchableOpacity : View;

  return (
    <CardWrapper 
      style={[styles.card, isClickable && styles.clickableCard]} 
      accessibilityRole={isClickable ? "button" : "summary"}
      accessibilityLabel={isClickable ? `${tripSummary} Tap to view details.` : tripSummary}
      accessibilityHint={isClickable ? "Tap to view trip details" : undefined}
      accessible={true}
      onPress={isClickable ? handlePress : undefined}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.modeText}>{modeLabel}</Text>
          <Text 
            style={styles.statusBadge}
            accessibilityLabel={`Trip ${trip.status}`}
          >
            {trip.status === 'active' ? '🔴 Active' : trip.status === 'paused' ? '⏸ Paused' : '✓ Completed'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.durationLabel}>Distance</Text>
          <Text style={styles.durationValue}>{distanceText}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Boldness:</Text>
        <Text style={styles.value}>{trip.boldness}/10</Text>
      </View>
      
      <View style={styles.row}>
        <Text style={styles.label}>Start:</Text>
        <Text style={styles.value}>{formatDateTime(trip.start_time)}</Text>
      </View>
      
      <View style={styles.row}>
        <Text style={styles.label}>End:</Text>
        <Text style={styles.value}>
          {trip.end_time ? formatDateTime(trip.end_time) : 'In Progress'}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Duration:</Text>
        <Text style={styles.value}>{formatDuration(trip.duration_seconds)}</Text>
      </View>
      
      {trip.purpose && (
        <View style={styles.row}>
          <Text style={styles.label}>Purpose:</Text>
          <Text style={styles.value}>
            {trip.purpose.charAt(0).toUpperCase() + trip.purpose.slice(1)}
          </Text>
        </View>
      )}
    </CardWrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clickableCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  modeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  durationLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  durationValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 80,
  },
  value: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
});
