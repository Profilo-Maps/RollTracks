# Requirements Document

## Introduction

This feature enables users to rate the accessibility of curb ramp features during active trips. Users can interact with displayed obstacles on the map, provide accessibility ratings on a 1-10 scale, and view their rated features in trip summaries. All rated features are persisted to local storage for later review and potential upload to a backend service.

## Glossary

- **Obstacle Feature**: A geographic point feature representing a curb ramp or accessibility feature, loaded from the curb_ramps.geojson file
- **Rated Feature**: An obstacle feature that has been assigned an accessibility rating by a user during a trip
- **Accessibility Rating**: A numerical score from 1 to 10 indicating how accessible a user found a particular feature
- **Active Trip Screen**: The screen displayed during an ongoing trip showing the map with current location and nearby obstacles
- **Trip Summary Screen**: The screen displayed after a trip is completed showing trip statistics and details
- **Rating Modal**: A popup dialog that allows users to input an accessibility rating using a slider control
- **Feature Popup**: A popup dialog that displays the properties and characteristics of an obstacle feature
- **RatingService**: The service responsible for managing rated features including storage and retrieval operations

## Requirements

### Requirement 1

**User Story:** As a mobility app user, I want to rate the accessibility of curb ramps I encounter during my trip, so that I can contribute feedback about real-world accessibility conditions.

#### Acceptance Criteria

1. WHEN a user taps an obstacle feature on the Active Trip Screen map THEN the system SHALL display a popup showing the feature's characteristics
2. WHEN the feature popup is displayed THEN the system SHALL include a "Rate Feature" button alongside the feature properties
3. WHEN a user taps the "Rate Feature" button THEN the system SHALL display a rating modal with the title "Accessibility Rating"
4. WHEN the rating modal is displayed THEN the system SHALL present a slider control allowing values from 1 to 10
5. WHEN a user adjusts the slider THEN the system SHALL display the current numeric value being selected

### Requirement 2

**User Story:** As a mobility app user, I want my accessibility ratings to be saved with trip context, so that my feedback is associated with when and where I encountered each feature.

#### Acceptance Criteria

1. WHEN a user confirms an accessibility rating THEN the system SHALL create a rated feature record containing all original obstacle properties
2. WHEN creating a rated feature record THEN the system SHALL add a userRating property with the slider value
3. WHEN creating a rated feature record THEN the system SHALL add a tripId property associating the rating with the current active trip
4. WHEN creating a rated feature record THEN the system SHALL add a timestamp property recording when the rating was created
5. WHEN a rated feature is created THEN the system SHALL persist it to local storage immediately

### Requirement 3

**User Story:** As a mobility app user, I want to prevent duplicate ratings of the same feature during a trip, so that my data remains clean and meaningful.

#### Acceptance Criteria

1. WHEN a user has already rated a feature during the current trip THEN the system SHALL display the existing rating in the feature popup
2. WHEN a feature has been rated in the current trip THEN the "Rate Feature" button SHALL change to "Update Rating"
3. WHEN a user updates an existing rating THEN the system SHALL replace the previous rating value while preserving the original timestamp
4. WHEN displaying a rated feature on the map THEN the system SHALL visually distinguish it from unrated features
5. WHEN a user rates a feature THEN the system SHALL provide immediate visual feedback confirming the rating was saved

### Requirement 4

**User Story:** As a mobility app user, I want to view all features I rated during a trip in the trip summary, so that I can review my accessibility feedback.

#### Acceptance Criteria

1. WHEN a user views a Trip Summary Screen THEN the system SHALL display all rated features associated with that trip on the map
2. WHEN rated features are displayed on the Trip Summary Screen THEN the system SHALL render them with visual markers distinct from the route
3. WHEN a user taps a rated feature on the Trip Summary Screen THEN the system SHALL display a popup with all feature properties including the user rating
4. WHEN the rated feature popup is displayed THEN the system SHALL show the accessibility rating value prominently
5. WHEN no features were rated during a trip THEN the Trip Summary Screen SHALL display only the route without rated feature markers

### Requirement 5

**User Story:** As a mobility app user, I want my rated features stored in a structured format, so that they can be exported or uploaded to a backend service in the future.

#### Acceptance Criteria

1. WHEN rated features are persisted THEN the system SHALL store them in GeoJSON format matching the curb_ramps.geojson structure
2. WHEN storing rated features THEN the system SHALL maintain all original properties from the obstacle feature
3. WHEN storing rated features THEN the system SHALL include geometry coordinates in GeoJSON Point format with longitude and latitude
4. WHEN retrieving rated features for a trip THEN the system SHALL return only features associated with that specific tripId
5. WHEN the storage contains rated features THEN the system SHALL provide a method to retrieve all rated features across all trips

### Requirement 6

**User Story:** As a developer, I want the rating feature to integrate seamlessly with existing services, so that the codebase remains maintainable and follows established patterns.

#### Acceptance Criteria

1. WHEN implementing the rating feature THEN the system SHALL create a RatingService following the same patterns as ObstacleService and TripService
2. WHEN the RatingService is created THEN the system SHALL use the LocalStorageAdapter for all persistence operations
3. WHEN storing rated features THEN the system SHALL use a dedicated storage key separate from trips and GPS points
4. WHEN the Active Trip Screen loads THEN the system SHALL initialize the RatingService alongside existing services
5. WHEN a trip ends THEN the system SHALL ensure all rated features are persisted before navigating to the Trip Summary Screen
