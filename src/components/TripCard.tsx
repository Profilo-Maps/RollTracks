import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Trip, Mode } from '../types';
import { canGradeTrip, formatRemainingTime, getRemainingGradingTime } from '../utils/timeValidation';
import { useServices } from '../contexts/ServicesContext';
import { useToast } from '../contexts/ToastContext';

interface TripCardProps {
  trip: Trip;
  onTripEnded?: () => void;
  onTripDeleted?: () => void;
  isHighlighted?: boolean;
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
 * Supports visual highlighting when navigated from HomeScreen
 */
export const TripCard: React.FC<TripCardProps> = ({ trip, onTripEnded, onTripDeleted, isHighlighted = false }) => {
  const navigation = useNavigation();
  const { tripService } = useServices();
  const { showSuccess, showError } = useToast();
  const [isEnding, setIsEnding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
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

  const handleResume = () => {
    (navigation as any).navigate('ActiveTrip', { tripId: trip.id });
  };

  const handleEndTrip = async () => {
    try {
      setIsEnding(true);
      await tripService.stopTrip(trip.id);
      showSuccess('Trip ended successfully');
      if (onTripEnded) {
        onTripEnded();
      }
    } catch (error: any) {
      showError(error.message || 'Failed to end trip');
    } finally {
      setIsEnding(false);
    }
  };

  const handleDeleteTrip = () => {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip? This action cannot be undone.',
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
              setIsDeleting(true);
              await tripService.deleteTrip(trip.id);
              showSuccess('Trip deleted successfully');
              if (onTripDeleted) {
                onTripDeleted();
              }
            } catch (error: any) {
              showError(error.message || 'Failed to delete trip');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Format timestamp for display
  const formatDateTime = (isoString: string): string => {
    const date = new Date(isoString);
    const timeString = date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const dayString = date.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    return `${timeString}, ${dayString}`;
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

  // Check grading availability
  const canGrade = canGradeTrip(trip);
  const remainingTime = getRemainingGradingTime(trip);

  const tripSummary = `Trip ${trip.status === 'completed' ? 'completed' : trip.status}. Mode: ${modeLabel}. Boldness: ${trip.boldness}. Distance: ${distanceText}. Started ${formatDateTime(trip.start_time)}. ${trip.end_time ? `Ended ${formatDateTime(trip.end_time)}.` : 'Still in progress.'} Duration: ${formatDuration(trip.duration_seconds)}.${canGrade ? ' Grading available.' : ''}`;

  const isActive = trip.status === 'active' || trip.status === 'paused';
  const isClickable = isActive || trip.status === 'completed';
  const CardWrapper = isClickable ? TouchableOpacity : View;

  return (
    <CardWrapper 
      style={[
        styles.card, 
        isClickable && styles.clickableCard,
        isHighlighted && styles.highlightedCard
      ]} 
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
          <View style={styles.statusRow}>
            <Text 
              style={styles.statusBadge}
              accessibilityLabel={`Trip ${trip.status}`}
            >
              {trip.status === 'active' ? '🔴 Active' : trip.status === 'paused' ? '⏸ Paused' : '✓ Completed'}
            </Text>
            {canGrade && (
              <Text style={styles.gradingBadge}>
                ⭐ Grading Available
              </Text>
            )}
          </View>
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

      {canGrade && (
        <View style={styles.row}>
          <Text style={styles.label}>Grading:</Text>
          <Text style={[styles.value, styles.gradingText]}>
            {formatRemainingTime(remainingTime)}
          </Text>
        </View>
      )}

      {isActive && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.resumeButton]}
            onPress={handleResume}
            accessibilityRole="button"
            accessibilityLabel="Resume trip"
            accessibilityHint="Navigate to active trip screen to continue recording"
            disabled={isEnding || isDeleting}
          >
            <Text style={styles.resumeButtonText}>▶️ Resume</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.endButton]}
            onPress={handleEndTrip}
            accessibilityRole="button"
            accessibilityLabel="End trip"
            accessibilityHint="Stop recording and complete this trip"
            disabled={isEnding || isDeleting}
          >
            {isEnding ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.endButtonText}>⏹️ End Trip</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.deleteButtonContainer}>
        <TouchableOpacity
          style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
          onPress={handleDeleteTrip}
          accessibilityRole="button"
          accessibilityLabel="Delete trip"
          accessibilityHint="Permanently delete this trip"
          disabled={isDeleting || isEnding}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#FF3B30" />
          ) : (
            <Text style={styles.deleteButtonText}>🗑️ Delete Trip</Text>
          )}
        </TouchableOpacity>
      </View>
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
  highlightedCard: {
    backgroundColor: '#FFFEF7',
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
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
  gradingBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FF9500',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
  gradingText: {
    color: '#FF9500',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  resumeButton: {
    backgroundColor: '#007AFF',
  },
  resumeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  endButton: {
    backgroundColor: '#FF3B30',
  },
  endButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButtonContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  deleteButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFE0E0',
    minHeight: 44,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '600',
  },
});
