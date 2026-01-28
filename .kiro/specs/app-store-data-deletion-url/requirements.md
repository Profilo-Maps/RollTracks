# Requirements Document

## Introduction

RollTracks needs to provide a web-accessible URL that allows users to request deletion of their account data. This is a compliance requirement for both the iOS App Store and Google Play Store, which mandate that apps provide users with a way to delete their data outside of the app itself. The feature will leverage the existing account deletion logic in AuthService.deleteAccount() and be hosted as a Supabase Edge Function to provide a publicly accessible endpoint.

## Glossary

- **User**: A person with a RollTracks account who wants to delete their data
- **Data_Deletion_Service**: The Supabase Edge Function that handles web-based account deletion requests
- **AuthService**: The existing mobile app service that contains the deleteAccount() logic
- **Supabase**: The backend platform hosting the database and edge functions
- **App_Store**: iOS App Store or Google Play Store
- **Session**: An authenticated user session with access and refresh tokens
- **CASCADE_DELETE**: Database constraint that automatically deletes related records when a parent record is deleted

## Requirements

### Requirement 1: Web-Accessible Deletion Endpoint

**User Story:** As a user, I want to access a web page to delete my RollTracks account data, so that I can remove my information without needing to use the mobile app.

#### Acceptance Criteria

1. THE Data_Deletion_Service SHALL provide a publicly accessible HTTPS URL
2. WHEN a user visits the deletion URL, THE Data_Deletion_Service SHALL display a web form for authentication
3. THE Data_Deletion_Service SHALL accept display name and password as authentication credentials
4. WHEN authentication succeeds, THE Data_Deletion_Service SHALL display a confirmation page with deletion details
5. THE Data_Deletion_Service SHALL require explicit user confirmation before proceeding with deletion

### Requirement 2: User Authentication

**User Story:** As a user, I want to authenticate with my display name and password, so that only I can delete my account data.

#### Acceptance Criteria

1. WHEN a user submits their display name and password, THE Data_Deletion_Service SHALL verify credentials against the user_accounts table
2. IF credentials are invalid, THEN THE Data_Deletion_Service SHALL display an error message and prevent deletion
3. WHEN authentication succeeds, THE Data_Deletion_Service SHALL create a temporary session for the deletion flow
4. THE Data_Deletion_Service SHALL use the same password verification logic as the mobile app (verify_password RPC function)

### Requirement 3: Data Deletion Execution

**User Story:** As a user, I want my account and all associated data to be permanently deleted, so that my information is completely removed from RollTracks.

#### Acceptance Criteria

1. WHEN a user confirms deletion, THE Data_Deletion_Service SHALL delete the user record from the user_accounts table
2. WHEN a user_accounts record is deleted, THE database SHALL automatically delete all related trips records via CASCADE_DELETE
3. WHEN a user_accounts record is deleted, THE database SHALL automatically delete all related rated_features records via CASCADE_DELETE
4. WHEN deletion completes successfully, THE Data_Deletion_Service SHALL display a success confirmation page
5. IF deletion fails, THEN THE Data_Deletion_Service SHALL display an error message with details

### Requirement 4: App Store Compliance

**User Story:** As an app store reviewer, I want to verify that users can delete their data through a web interface, so that the app meets data deletion requirements.

#### Acceptance Criteria

1. THE Data_Deletion_Service SHALL be accessible without requiring the mobile app to be installed
2. THE Data_Deletion_Service SHALL provide a stable URL that can be submitted to app stores
3. THE Data_Deletion_Service SHALL comply with GDPR right to erasure requirements
4. THE Data_Deletion_Service SHALL comply with CCPA data deletion requirements
5. WHEN deletion is complete, THE Data_Deletion_Service SHALL provide confirmation that all user data has been removed

### Requirement 5: Security and Error Handling

**User Story:** As a system administrator, I want the deletion service to be secure and handle errors gracefully, so that user data is protected and the service is reliable.

#### Acceptance Criteria

1. THE Data_Deletion_Service SHALL use HTTPS for all communications
2. THE Data_Deletion_Service SHALL validate all user inputs to prevent injection attacks
3. IF the database is unavailable, THEN THE Data_Deletion_Service SHALL display a user-friendly error message
4. THE Data_Deletion_Service SHALL log all deletion attempts for audit purposes
5. THE Data_Deletion_Service SHALL rate limit deletion requests to prevent abuse (maximum 5 attempts per IP per hour)
6. WHEN authentication fails, THE Data_Deletion_Service SHALL not reveal whether the display name exists

### Requirement 6: User Interface

**User Story:** As a user, I want a simple and clear web interface, so that I can easily understand and complete the deletion process.

#### Acceptance Criteria

1. THE Data_Deletion_Service SHALL display a clear explanation of what data will be deleted
2. THE Data_Deletion_Service SHALL list the types of data that will be removed (trips, ratings, profile information)
3. THE Data_Deletion_Service SHALL warn users that deletion is permanent and cannot be undone
4. THE Data_Deletion_Service SHALL use clear, non-technical language in all messages
5. THE Data_Deletion_Service SHALL be mobile-responsive and work on all device sizes
