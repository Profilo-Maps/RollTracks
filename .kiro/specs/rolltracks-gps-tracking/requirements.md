# Requirements Document

## Introduction

RollTracks is a mobility tracking application designed for users who utilize various modes of personal transportation including wheelchairs, assisted walking devices, skateboards, scooters, and walking. The application enables users to record trips with GPS tracking, rate their experience through a "boldness" metric, and view historical trip data with statistics. The system transforms an existing prototype into a comprehensive GPS-enabled tracking platform with enhanced profile management and trip recording capabilities.

## Glossary

- **RollTracks**: The mobile application system for tracking mobility trips
- **User**: An individual who uses the RollTracks application to track their trips
- **Profile**: A user's account information containing age, mode list, and trip history
- **Mode**: A type of personal transportation (wheelchair, assisted walking, skateboard, scooter, walking)
- **Mode List**: The collection of transportation modes a user has selected as their available options
- **Trip**: A recorded journey with start time, end time, mode, boldness rating, purpose, and GPS data
- **Boldness**: A user-defined rating from 1-10 indicating the adventurousness or difficulty of a trip
- **Purpose**: The reason for taking a trip (e.g., commute, recreation, errands)
- **GPS Data**: Geographic location information captured during a trip
- **Encoded Polyline**: A compressed format for storing GPS route geometry
- **Trip History**: The complete collection of all trips recorded by a user
- **Active Trip**: A trip currently being recorded with ongoing GPS capture
- **Transit Leg**: A pause in GPS recording during a trip (e.g., when using public transportation)
- **Bottom Menu Bar**: The navigation bar at the bottom of the screen with Record and History options
- **Profile Button**: A button in the top right corner that navigates to the Profile Page

## Requirements

### Requirement 1: Initial Profile Creation

**User Story:** As a new user, I want to create a profile when I first open the app, so that I can configure my transportation modes and begin tracking trips.

#### Acceptance Criteria

1. WHEN the RollTracks application is opened for the first time THEN the system SHALL display the Create Profile Page
2. WHEN displaying the Create Profile Page THEN the system SHALL hide the Profile Button and Bottom Menu Bar
3. WHEN a user is on the Create Profile Page THEN the system SHALL provide an input field for age
4. WHEN a user is on the Create Profile Page THEN the system SHALL provide a multi-select interface for choosing modes from the list [wheelchair, assisted walking, skateboard, scooter, walking]
5. WHEN a user submits the profile form with valid age and at least one selected mode THEN the system SHALL create a new profile record with the provided information
6. WHEN a profile is successfully created THEN the system SHALL navigate the user to the Profile Page

### Requirement 2: Profile Management

**User Story:** As a user, I want to view and edit my profile information, so that I can update my age or change my available transportation modes.

#### Acceptance Criteria

1. WHEN a user has completed profile creation THEN the system SHALL display the Profile Button on the Record Page and History Page
2. WHEN a user clicks the Profile Button THEN the system SHALL navigate to the Profile Page
3. WHEN displaying the Profile Page THEN the system SHALL show the user's age as a readable text element
4. WHEN displaying the Profile Page THEN the system SHALL show the user's Mode List as readable text elements
5. WHEN a user clicks on the age display on the Profile Page THEN the system SHALL navigate to the Edit Profile Page
6. WHEN a user clicks on the Mode List display on the Profile Page THEN the system SHALL navigate to the Edit Profile Page
7. WHEN displaying the Edit Profile Page THEN the system SHALL pre-populate form fields with the user's current age and selected modes
8. WHEN a user submits the Edit Profile form with valid changes THEN the system SHALL update the profile record with the new information

### Requirement 3: Profile Statistics Display

**User Story:** As a user, I want to see statistics about my trips on my profile, so that I can understand my travel patterns and boldness trends.

#### Acceptance Criteria

1. WHEN displaying the Profile Page THEN the system SHALL calculate and display the average boldness across all completed trips
2. WHEN displaying average boldness THEN the system SHALL format the value to one decimal place
3. WHEN displaying the Profile Page THEN the system SHALL calculate and display the average trip length in miles across all completed trips
4. WHEN displaying average trip length THEN the system SHALL format the value to two decimal places
5. WHEN a user has no completed trips THEN the system SHALL display appropriate placeholder text for statistics

### Requirement 4: Trip Initialization

**User Story:** As a user, I want to configure trip parameters before starting a trip, so that I can accurately categorize my journey.

#### Acceptance Criteria

1. WHEN a user clicks Record on the Bottom Menu Bar THEN the system SHALL navigate to the Record (Start Trip) Page
2. WHEN displaying the Record (Start Trip) Page THEN the system SHALL provide a dropdown menu for selecting mode
3. WHEN displaying the mode dropdown THEN the system SHALL populate options with the modes from the user's Mode List
4. WHEN displaying the Record (Start Trip) Page THEN the system SHALL provide a dropdown menu for selecting boldness
5. WHEN displaying the boldness dropdown THEN the system SHALL provide options from 1 to 10
6. WHEN displaying the boldness dropdown label THEN the system SHALL include an information symbol button
7. WHEN a user clicks the information symbol button THEN the system SHALL display a popup with the boldness definition
8. WHEN displaying the Record (Start Trip) Page THEN the system SHALL show a play button labeled "Start Trip"
9. WHEN neither mode nor boldness has been selected THEN the system SHALL display the Start Trip button in a disabled grey state
10. WHEN both mode and boldness have been selected THEN the system SHALL display the Start Trip button in an enabled green state

### Requirement 5: GPS Trip Recording

**User Story:** As a user, I want to record my trip with GPS tracking, so that I can capture the exact route I traveled.

#### Acceptance Criteria

1. WHEN a user presses the Start Trip button THEN the system SHALL create a new trip record with the selected mode, boldness, and current timestamp as start time
2. WHEN a trip record is created THEN the system SHALL begin capturing GPS location data
3. WHEN GPS data is being captured THEN the system SHALL store location points for encoding as a polyline
4. WHEN a trip is started THEN the system SHALL navigate to the Record (Active Trip) Page
5. WHEN displaying the Record (Active Trip) Page THEN the system SHALL hide the Profile Button and Bottom Menu Bar
6. WHEN displaying the Record (Active Trip) Page THEN the system SHALL show a pause button labeled "Transit Leg"
7. WHEN displaying the Record (Active Trip) Page THEN the system SHALL show a stop button labeled "End Trip"

### Requirement 6: Trip Pause and Resume

**User Story:** As a user, I want to pause GPS recording during transit legs, so that I don't record inaccurate location data when using public transportation.

#### Acceptance Criteria

1. WHEN a user presses the Transit Leg button during an active trip THEN the system SHALL pause GPS data capture
2. WHEN GPS capture is paused THEN the system SHALL maintain the trip record without setting an end time
3. WHEN GPS capture is paused THEN the system SHALL change the Transit Leg button to a play button
4. WHEN a user presses the play button after pausing THEN the system SHALL resume GPS data capture
5. WHEN GPS capture resumes THEN the system SHALL continue appending location data to the existing trip

### Requirement 7: Trip Completion

**User Story:** As a user, I want to end my trip and save the recorded data, so that I can review it later in my trip history.

#### Acceptance Criteria

1. WHEN a user presses the End Trip button THEN the system SHALL stop GPS data capture
2. WHEN GPS capture stops THEN the system SHALL encode the captured location data as a polyline
3. WHEN the polyline is encoded THEN the system SHALL update the trip record with the end time as the current timestamp
4. WHEN the trip record is updated with end time THEN the system SHALL calculate and store the trip distance in miles
5. WHEN the trip is saved THEN the system SHALL navigate to the Record (Trip Summary) Page

### Requirement 8: Trip Summary Display

**User Story:** As a user, I want to see a summary of my completed trip immediately after ending it, so that I can verify the trip was recorded correctly.

#### Acceptance Criteria

1. WHEN the trip save operation fails THEN the system SHALL display an error message on the Record (Trip Summary) Page
2. WHEN the trip save operation succeeds THEN the system SHALL display "Trip Complete!" text on the Record (Trip Summary) Page
3. WHEN displaying a successful trip summary THEN the system SHALL show the trip's mode
4. WHEN displaying a successful trip summary THEN the system SHALL show the trip's boldness rating
5. WHEN displaying a successful trip summary THEN the system SHALL show the trip's total distance in miles
6. WHEN displaying the Record (Trip Summary) Page THEN the system SHALL show an X button in the top right corner
7. WHEN a user clicks the X button THEN the system SHALL navigate back to the Record (Start Trip) Page

### Requirement 9: Trip History Viewing

**User Story:** As a user, I want to view all my past trips with their details, so that I can review my travel history.

#### Acceptance Criteria

1. WHEN a user clicks History on the Bottom Menu Bar THEN the system SHALL navigate to the History Page
2. WHEN displaying the History Page THEN the system SHALL retrieve all completed trips for the user
3. WHEN displaying the History Page THEN the system SHALL show each trip as a trip card
4. WHEN displaying a trip card THEN the system SHALL show the trip's mode
5. WHEN displaying a trip card THEN the system SHALL show the trip's start time
6. WHEN displaying a trip card THEN the system SHALL show the trip's end time
7. WHEN displaying a trip card THEN the system SHALL show the trip's distance in miles
8. WHEN displaying trips on the History Page THEN the system SHALL order them by start time with most recent first

### Requirement 10: Data Persistence

**User Story:** As a user, I want my profile and trip data to be saved reliably, so that I don't lose my information when I close the app.

#### Acceptance Criteria

1. WHEN a profile is created or updated THEN the system SHALL persist the profile data to local storage
2. WHEN a trip is completed THEN the system SHALL persist the trip data including encoded polyline to local storage
3. WHEN the application is reopened THEN the system SHALL retrieve the user's profile from local storage
4. WHEN the History Page is displayed THEN the system SHALL retrieve all trip records from local storage
5. WHEN local storage operations fail THEN the system SHALL display appropriate error messages to the user

### Requirement 11: GPS Permission Handling

**User Story:** As a user, I want the app to request GPS permissions appropriately, so that I understand why location access is needed.

#### Acceptance Criteria

1. WHEN a user attempts to start a trip for the first time THEN the system SHALL request location permissions from the device
2. WHEN location permissions are denied THEN the system SHALL display an error message explaining that GPS is required for trip recording
3. WHEN location permissions are granted THEN the system SHALL proceed with trip recording
4. WHEN location services are disabled on the device THEN the system SHALL display an error message prompting the user to enable location services

### Requirement 12: Polyline Encoding

**User Story:** As a developer, I want GPS data to be stored efficiently as encoded polylines, so that the application uses minimal storage space.

#### Acceptance Criteria

1. WHEN GPS location points are captured during a trip THEN the system SHALL store them in a format suitable for polyline encoding
2. WHEN a trip is completed THEN the system SHALL encode the GPS points using the polyline encoding algorithm
3. WHEN the encoded polyline is generated THEN the system SHALL store it in the trip record's geometry field
4. WHEN displaying trip history THEN the system SHALL be capable of decoding polylines for distance calculation or map display
