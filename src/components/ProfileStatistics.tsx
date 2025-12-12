import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Statistics } from '../services';

interface ProfileStatisticsProps {
  statistics: Statistics;
}

export const ProfileStatistics: React.FC<ProfileStatisticsProps> = ({
  statistics,
}) => {
  const hasTrips = statistics.totalTrips > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trip Statistics</Text>

      {hasTrips ? (
        <>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Average Boldness:</Text>
            <Text style={styles.statValue}>
              {statistics.averageBoldness.toFixed(1)}/10
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Average Trip Length:</Text>
            <Text style={styles.statValue}>
              {statistics.averageTripLength.toFixed(2)} miles
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total Trips:</Text>
            <Text style={styles.statValue}>
              {statistics.totalTrips}
            </Text>
          </View>
        </>
      ) : (
        <Text style={styles.placeholderText}>
          No trips recorded yet. Start tracking your journeys to see statistics!
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  placeholderText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 8,
    lineHeight: 20,
  },
});
