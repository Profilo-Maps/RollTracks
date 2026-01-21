# Requirements Document

## Introduction

This document specifies the requirements for adding a Home Screen to a React Native navigation app that displays all user-rated accessibility features on a map. The Home Screen will serve as the central hub between the Record and History screens, providing users with a visual overview of all features they have rated across all trips. Users can interact with rated features to navigate to the specific trip where each feature was most recently evaluated.

## Glossary

- **Home_Screen**: The new central navigation tab that displays a map with all rated features
- **Rated_Feature**: An accessibility feature (obstacle) that a user has evaluated with a rating (1-10) during a trip
- **Feature_Marker**: A visual representation of a rated feature on the map
- **Trip_History_Screen**: The existing screen that displays a list of all user trips
- **Rating_Service**: The service that provides access to rating data (getAllRatings, getRatingsForTrip, getRatingForFeature)
- **MapView_Mapbox**: The existing map component used for displaying Mapbox maps
- **Bottom_Tab_Navigator**: The React Navigation component managing the app's main navigation tabs
- **Most_Recent_Rating**: The latest rating for a specific feature across all trips, determined by timestamp

## Requirements

### Requirement 1: Home Screen Creation and Navigation Integration

**User Story:** As a user, I want to access a home screen from the navigation bar, so that I can view all my rated features in one place.

#### Acceptance Criteria

1. THE Bottom_Tab_Navigator SHALL include a Home_Screen tab positioned between the Record tab and History tab
2. WHEN a user taps the Home tab, THE Bottom_Tab_Navigator SHALL navigate to the Home_Screen
3. THE Home_Screen SHALL display a tab icon and label consistent with the app's design system
4. WHEN the Home_Screen is active, THE Bottom_Tab_Navigator SHALL highlight the Home tab

### Requirement 2: Rated Features Map Display

**User Story:** As a user, I want to see all my rated features displayed on a map, so that I can visualize where I have provided accessibility ratings.

#### Acceptance Criteria

1. THE Home_Screen SHALL use the MapView_Mapbox component to display a map
2. WHEN the Home_Screen loads, THE Home_Screen SHALL fetch all rated features using Rating_Service.getAllRatings()
3. THE Home_Screen SHALL display a Feature_Marker for each unique rated feature on the map
4. WHEN multiple ratings exist for the same feature, THE Home_Screen SHALL display only one Feature_Marker at that location
5. THE Home_Screen SHALL center the map viewport on the geographic bounds of all rated features
6. WHEN no rated features exist, THE Home_Screen SHALL center the map on a default location

### Requirement 3: Feature Marker Visual Representation

**User Story:** As a user, I want rated features to be visually distinct on the map, so that I can quickly understand the rating quality of different features.

#### Acceptance Criteria

1. THE Feature_Marker SHALL display a visual indicator based on the most recent rating value (1-10)
2. THE Home_Screen SHALL use a color scheme to represent rating ranges (e.g., red for low ratings, green for high ratings)
3. THE Feature_Marker SHALL be clearly visible and distinguishable from other map elements
4. WHEN a feature has been rated multiple times, THE Feature_Marker SHALL reflect the Most_Recent_Rating

### Requirement 4: Feature Marker Interaction

**User Story:** As a user, I want to tap on a rated feature marker, so that I can view details about the trip where I most recently rated that feature.

#### Acceptance Criteria

1. WHEN a user taps a Feature_Marker, THE Home_Screen SHALL determine the trip_id associated with the Most_Recent_Rating for that feature
2. WHEN a user taps a Feature_Marker, THE Home_Screen SHALL navigate to the Trip_History_Screen
3. WHEN navigating to Trip_History_Screen, THE Home_Screen SHALL pass the trip_id as a navigation parameter
4. THE Trip_History_Screen SHALL highlight or scroll to the specified trip when a trip_id parameter is provided

### Requirement 5: Loading and Empty States

**User Story:** As a user, I want clear feedback when the map is loading or when I have no rated features, so that I understand the current state of the screen.

#### Acceptance Criteria

1. WHEN the Home_Screen is fetching rated features, THE Home_Screen SHALL display a loading indicator
2. WHEN no rated features exist, THE Home_Screen SHALL display an empty state message informing the user
3. WHEN the Rating_Service fails to fetch data, THE Home_Screen SHALL display an error message
4. THE Home_Screen SHALL allow users to retry fetching data after an error

### Requirement 6: Performance and Data Handling

**User Story:** As a user, I want the home screen to load quickly even with many rated features, so that I have a smooth experience.

#### Acceptance Criteria

1. WHEN the Home_Screen has more than 100 rated features, THE Home_Screen SHALL render markers efficiently without blocking the UI
2. THE Home_Screen SHALL determine the Most_Recent_Rating for each unique feature by comparing timestamps
3. THE Home_Screen SHALL handle offline mode by displaying locally stored ratings
4. WHEN new ratings are added, THE Home_Screen SHALL refresh the map display when returning to the Home tab

### Requirement 7: Map Interaction and User Experience

**User Story:** As a user, I want to interact with the map naturally, so that I can explore my rated features.

#### Acceptance Criteria

1. THE Home_Screen SHALL allow users to pan the map to explore different areas
2. THE Home_Screen SHALL allow users to zoom in and out on the map
3. THE Home_Screen SHALL maintain map interaction responsiveness with all rated features displayed
4. WHEN the user navigates away and returns to the Home_Screen, THE Home_Screen SHALL preserve the map viewport state
