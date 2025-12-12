import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { FeaturePopupProps } from '../types';

export const FeaturePopup: React.FC<FeaturePopupProps> = ({
  feature,
  visible,
  onClose,
  onRate,
  tripId,
}) => {
  if (!visible) {
    return null;
  }

  const buttonText = feature.isRated ? 'Update Rating' : 'Rate Feature';
  const hasRating = feature.rating !== undefined;
  const conditionScore = feature.attributes?.conditionScore;
  const locationDescription = feature.attributes?.LocationDescription || 'Unknown location';

  // Get condition text and color
  let conditionText = 'Unknown';
  let conditionColor = '#999999';
  
  if (conditionScore !== null && conditionScore !== undefined) {
    if (conditionScore >= 50) {
      conditionText = `Good (${conditionScore})`;
      conditionColor = '#4CAF50';
    } else if (conditionScore >= 0) {
      conditionText = `Fair (${conditionScore})`;
      conditionColor = '#FF9500';
    } else {
      conditionText = `Poor (${conditionScore})`;
      conditionColor = '#9C27B0';
    }
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.bubble}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          accessibilityLabel="Close popup"
          accessibilityRole="button"
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        {hasRating && (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingBadgeText}>★ {feature.rating}/10</Text>
          </View>
        )}

        <Text style={[styles.locationText, hasRating && styles.locationTextWithRating]} numberOfLines={2}>
          {locationDescription}
        </Text>

        <View style={styles.conditionRow}>
          <Text style={styles.conditionLabel}>Condition:</Text>
          <Text style={[styles.conditionValue, { color: conditionColor }]}>
            {conditionText}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.rateButton}
          onPress={onRate}
          accessibilityLabel={buttonText}
          accessibilityRole="button"
          accessibilityHint={
            feature.isRated
              ? 'Tap to update your accessibility rating'
              : 'Tap to rate the accessibility of this feature'
          }
        >
          <Text style={styles.rateButtonText}>{buttonText}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 200, // Positioned above the pause/transit leg button
    left: 20,
    right: 20,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  bubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '600',
  },
  ratingBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
    paddingRight: 32,
  },
  locationTextWithRating: {
    marginTop: 28,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  conditionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    marginRight: 8,
  },
  conditionValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  rateButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  rateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
