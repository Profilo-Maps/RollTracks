# Privacy Policy

**Last Updated:** January 21, 2026  
**Version:** 1.0

---

## Introduction

Welcome to RollTracks. We are committed to protecting your privacy and being transparent about how we handle your data. This Privacy Policy explains what information we collect, how we use it, and your rights regarding your personal data.

RollTracks is designed with privacy in mind. The app works fully offline by default, storing all data locally on your device. Cloud synchronization is entirely optional and requires you to create an account.

---

## Information We Collect

### Location Data

RollTracks collects GPS location data when you actively record a trip. This includes:

- **Latitude and longitude coordinates**: Recorded at regular intervals during active trips
- **Timestamp**: When each location point was recorded
- **Accuracy**: The precision of each GPS reading (in meters)

Location tracking only occurs when you explicitly start a trip and stops when you end the trip. The app does not track your location in the background or when you're not actively recording.

### Trip Information

When you record a trip, we collect:

- **Mode of transportation**: Your selected mobility mode (wheelchair, assisted walking, skateboard, scooter, or walking)
- **Boldness level**: Your self-assessed comfort level (1-10 scale)
- **Trip purpose**: Optional categorization (work, recreation, or other)
- **Trip duration**: Start and end times
- **Distance traveled**: Calculated from GPS points
- **Route geometry**: Encoded representation of your traveled path

### Accessibility Ratings

If you choose to rate accessibility features during trips:

- **Feature ratings**: Your 1-10 ratings of curb ramps and other accessibility features
- **Rating timestamps**: When ratings were submitted
- **Feature locations**: Geographic coordinates of rated features

### User Profile (Cloud Mode Only)

If you create an account for cloud synchronization:

- **Display name**: A username you choose (not your real name)
- **Password**: Securely hashed and stored
- **Age**: Optional demographic information
- **Preferred mobility modes**: Your typical modes of transportation

**Important**: We do NOT collect email addresses, phone numbers, or other personally identifiable contact information.

---

## How We Use Your Information

### App Functionality

Your data is used to:

- Display your current location and route during active trips
- Calculate trip statistics (distance, duration)
- Show your trip history
- Visualize accessibility features on the map
- Provide personalized trip recommendations based on your mobility mode

### App Improvements

We may use aggregated, anonymized data to:

- Improve route calculations and distance accuracy
- Enhance map visualization performance
- Identify areas with accessibility gaps
- Improve the overall user experience

**Note**: Display names are excluded from any research data exports to protect your privacy.

### No Advertising or Third-Party Sharing

We do NOT:

- Sell your data to third parties
- Use your data for advertising
- Share your personal information with marketers
- Track you across other apps or websites

---

## Data Storage

### Local Storage (Default Mode)

By default, all your data is stored locally on your device using:

- **AsyncStorage**: For trip data, user preferences, and ratings
- **Device file system**: For GPS tracks and any uploaded photos

Data stored locally remains on your device and is not transmitted anywhere unless you enable cloud synchronization.

### Cloud Storage (Optional)

If you create an account and enable cloud sync:

- Data is stored in a Supabase database (a secure, open-source backend service)
- GPS tracks and photos are stored in Supabase Storage
- All data transmission uses HTTPS encryption
- Row-level security ensures you can only access your own data

You can use the app entirely offline without creating an account. Cloud sync is completely optional.

---

## Third-Party Services

RollTracks uses the following third-party services:

### Mapbox

- **Purpose**: Provides map tiles for visualization
- **Data Shared**: Map tile requests may include your approximate location (tile coordinates)
- **Privacy Policy**: [https://www.mapbox.com/legal/privacy](https://www.mapbox.com/legal/privacy)

### Supabase (Cloud Mode Only)

- **Purpose**: Provides cloud database and storage for optional multi-device sync
- **Data Shared**: All data you choose to sync (trips, ratings, profile)
- **Privacy Policy**: [https://supabase.com/privacy](https://supabase.com/privacy)

### No Analytics Services

RollTracks does NOT currently use analytics services like Google Analytics, Firebase Analytics, or similar tracking tools.

---

## Your Rights and Choices

### Access Your Data

You have full access to all your data through the app:

- View all trips in the Trip History screen
- See your profile information in the Profile screen
- Export your data (feature coming soon)

### Delete Your Data

You can delete your data at any time:

- **Individual trips**: Delete from Trip History screen
- **All local data**: Uninstall the app (removes all local storage)
- **Cloud account**: Use the "Delete Account" option in Profile settings (permanently removes all cloud data)

### Control Cloud Sync

If you've enabled cloud sync, you can:

- Stop syncing at any time by logging out
- Choose which data to sync (trips, ratings, profile)
- Delete your cloud account while keeping local data

### Opt Out of Data Collection

You can choose not to use RollTracks if you don't want to share location data. The app requires location permissions to function, as trip tracking is its core purpose.

---

## Data Retention

### Active Data

- **Local storage**: Data remains on your device until you delete it or uninstall the app
- **Cloud storage**: Data remains in your account until you delete it or close your account

### Deleted Data

- **Local deletion**: Immediately removed from device storage
- **Cloud deletion**: Permanently removed from our servers within 30 days
- **Account deletion**: All associated data is permanently deleted within 30 days

### Inactive Accounts

Accounts inactive for more than 2 years may be flagged for deletion. We will attempt to notify you before deleting inactive accounts.

---

## Security Measures

We take data security seriously and implement:

### Technical Safeguards

- **Encryption in transit**: All cloud data transmission uses HTTPS/TLS
- **Encryption at rest**: Cloud database and storage use encryption
- **Password hashing**: Passwords are never stored in plain text
- **Row-level security**: Database policies prevent unauthorized access

### Access Controls

- **Authentication required**: Cloud data requires login
- **User isolation**: You can only access your own data
- **No admin backdoors**: Even we cannot access your data without your credentials

### Device Security

- Your local data security depends on your device's security (screen lock, encryption)
- We recommend enabling device encryption and using a strong screen lock

---

## Children's Privacy

RollTracks is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us so we can delete it.

---

## Changes to This Policy

We may update this Privacy Policy from time to time to reflect:

- Changes in our data practices
- New features or services
- Legal or regulatory requirements

### How We Notify You

- **In-app notification**: We'll display a notice when you open the app after a policy update
- **Version number**: The "Last Updated" date and version number at the top will change
- **Material changes**: For significant changes, we'll require you to review and accept the new policy

### Your Continued Use

By continuing to use RollTracks after policy changes, you accept the updated terms. If you don't agree with changes, you can delete your account and stop using the app.

---

## Contact Us

If you have questions, concerns, or requests regarding this Privacy Policy or your data:

**Email:** privacy@rolltracks.app  
**Subject Line:** Privacy Inquiry

We will respond to privacy inquiries within 30 days.

---

## Legal Basis for Processing (GDPR)

If you are in the European Economic Area (EEA), our legal basis for processing your data is:

- **Consent**: You explicitly consent by using the app and enabling location tracking
- **Legitimate interests**: Improving the app and accessibility research (with anonymized data)
- **Contract performance**: Providing cloud sync services if you create an account

You have the right to withdraw consent at any time by stopping use of the app or deleting your account.

---

## California Privacy Rights (CCPA)

If you are a California resident, you have additional rights:

- **Right to know**: What personal information we collect and how we use it
- **Right to delete**: Request deletion of your personal information
- **Right to opt-out**: We don't sell personal information, so no opt-out is needed
- **Non-discrimination**: We won't discriminate against you for exercising your rights

To exercise these rights, contact us using the information above.

---

## Data Portability

You have the right to receive your data in a portable format. While we're building an export feature, you can currently:

- View all trips and ratings in the app
- Contact us to request a data export in JSON format

---

## Acknowledgment

By using RollTracks, you acknowledge that you have read and understood this Privacy Policy and agree to its terms.

Thank you for trusting RollTracks with your mobility data. We're committed to protecting your privacy while helping improve accessibility for everyone.
