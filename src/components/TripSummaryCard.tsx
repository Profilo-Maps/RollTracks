import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Trip, Mode, ObstacleFeature, RatedFeature } from '../types';

interface TripSummaryCardProps {
  trip: Trip | null;
  onClose: () => void;
  error?: string | null;
  obstacles?: ObstacleFeature[];
  ratedFeatures?: RatedFeature[];
}

const MODE_LABELS: Record<Mode, string> = {
  wheelchair: 'Wheelchair',
  assisted_walking: 'Assisted Walking',
  skateboard: 'Skateboard',
  scooter: 'Scooter',
  walking: 'Walking',
};

// Helper function to get star color based on rating
const getStarColor = (rating: number): string => {
  if (rating >= 8) return '#4CAF50'; // Green for good
  if (rating >= 5) return '#FFC107'; // Yellow for moderate
  return '#f44336'; // Red for poor
};

export const TripSummaryCard: React.FC<TripSummaryCardProps> = ({
  trip,
  onClose,
  error,
  obstacles = [],
  ratedFeatures = [],
}) => {
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.errorTitle}>Error</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
      </View>
    );
  }

  if (!trip) {
    return null;
  }

  // Create a map of obstacle ratings
  const ratingMap = new Map<string, number>();
  ratedFeatures.forEach(rated => {
    ratingMap.set(rated.id, rated.userRating);
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trip Complete!</Text>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          accessibilityLabel="Close trip summary"
          accessibilityRole="button"
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Mode:</Text>
            <Text style={styles.value}>{MODE_LABELS[trip.mode as Mode]}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Boldness:</Text>
            <Text style={styles.value}>{trip.boldness}/10</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Distance:</Text>
            <Text style={styles.value}>
              {trip.distance_miles !== null
                ? `${trip.distance_miles.toFixed(2)} miles`
                : 'N/A'}
            </Text>
          </View>

          {trip.purpose && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Purpose:</Text>
              <Text style={styles.value}>
                {trip.purpose.charAt(0).toUpperCase() + trip.purpose.slice(1)}
              </Text>
            </View>
          )}

          {trip.duration_seconds !== null && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Duration:</Text>
              <Text style={styles.value}>
                {formatDuration(trip.duration_seconds)}
              </Text>
            </View>
          )}

          {/* Obstacles Section */}
          {obstacles.length > 0 && (
            <View style={styles.obstaclesSection}>
              <Text style={styles.sectionTitle}>
                Obstacles Encountered ({obstacles.length})
              </Text>
              <View style={styles.obstaclesList}>
                {obstacles.map((obstacle, index) => {
                  const rating = ratingMap.get(obstacle.id);
                  const isRated = rating !== undefined;
                  
                  return (
                    <View key={obstacle.id} style={styles.obstacleItem}>
                      <View style={styles.obstacleInfo}>
                        <Text style={styles.obstacleNumber}>#{index + 1}</Text>
                        <Text style={styles.obstacleType} numberOfLines={1}>
                          {obstacle.attributes.STREET || 'Unknown Location'}
                        </Text>
                      </View>
                      <View style={styles.ratingIndicator}>
                        {isRated ? (
                          <>
                            <Text 
                              style={[
                                styles.starIcon, 
                                { color: getStarColor(rating) }
                              ]}
                            >
                              ★
                            </Text>
                            <Text style={styles.ratingText}>{rating}/10</Text>
                          </>
                        ) : (
                          <Text style={styles.unratedText}>Not rated</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4CAF50',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f44336',
  },
  closeButton: {
    padding: 4,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
    fontWeight: '300',
  },
  scrollContent: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  value: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  errorMessage: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    paddingVertical: 8,
  },
  obstaclesSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  obstaclesList: {
    gap: 8,
  },
  obstacleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  obstacleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  obstacleNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    marginRight: 8,
    minWidth: 30,
  },
  obstacleType: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  ratingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starIcon: {
    fontSize: 20,
    fontWeight: '700',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  unratedText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});
