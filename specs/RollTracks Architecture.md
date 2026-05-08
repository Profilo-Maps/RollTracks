# RollTracks Architecture

## Overview

**RollTracks** is a privacy-first route sharing platform that helps create an anonymized, open dataset of non-car transport activity for routing and traffic modeling analysis. It seeks to create a user friendly, open source data crowdsourcing platform that delivers functionality often locked behind enterprise software licenses.

The app was built around gathering data on wheelchair users, skateboarders, and other travelers sensitive to ADA compliance. It is, however, **a generalized framework for recording and publishing anonymized route data for any human scale mode of transport.** 

Anonymization is accomplished through 6 layers of obfuscation: Relative Time Usage, Charecteristic Binning, Clipping Origins and Destinations to Census Blocks, Sidewalk Network Snapping, Procedural Synthetic Data Creation for k-anonymity, and user credential removal. The idea here is to minimize identifiability and while maximizing the richness and quality of data. 

Embedded in the app is **DataRanger mode**, a suite of tools that can be used to assess and update both point and linear feature data to help improve urban data quality.

In this implementation, we are concerned with:
- Validating city-assigned condition scores of curb ramps
- Correcting AI-generated sidewalk network data

Using both the baseline route data and the advanced DataRanger information, a skateboard and wheelchair-specific model of Level of Traffic Stress can be developed, allowing for their better integration with existing urban design regimes.

> **Future Development**: Potential for the addition of more obstacle and segment types as well as the tokenization of each piece of data a user contributes, allowing for market-based incentivization. Tokens could be traded for premium features or a discounted membership feature bundle, and could optionally be purchased with cash.

**Technology Stack**: React Native Expo 

---

## Architecture Diagram

### Model-ViewModel-View Pattern

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                                 DATA MODEL                                    │
│              (Supabase, Mapbox, Native Sensors, Proximity)                    │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ The core of the data model is stored in user, base proximity, and corrected   │
│ proximity tables stored on Supabase. In addition, Mapbox data is used for     │
│ Maptiles,Native GPS functionality is used to track user location, and         │
│ external opendata is loaded for user assessment. In later builds, server-side │
│ functions will dynamically update these data tables as users provide ground   │
│ truth data, improving the quality of the base data set.                       │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
                                      │ ▲
                                      ▼ │
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ADAPTERS                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ The Adapters fetch data from all of the model services and then serve it    │
│ to the View-Model Services. These adapters allow for easier switching of    │
│ cloud services.                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │ ▲
                                      ▼ │
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VIEW-MODEL SERVICES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ The View-Model services read data from and serve data to the Adapters to    │
│ facilitate data visualization and model updating. The data that is read     │
│ from models is served to components and screens in order to visualize them  │
│ and solicit user feedback. Contexts indicate the user's current data        │
│ domain of focus.                                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │ ▲
                                      ▼ │
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SCREENS AND COMPONENTS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Screens are groupings of UI elements that allow users to view and write to │
│ subsets of model data. These include the home screen, profile screen,      │
│ active trip screen, etc. Components are UI elements used by multiple       │
│ screens and thus warrant containerization outside of one particular        │
│ screen. This is the interface between our data model and the user's        │
│ perceptual model of the built environment.                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │ ▲
                                      ▼ │
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER INPUT                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ The most important part of this data set is the user's mental model of the │
│ built environment, which we access through their input. This is the        │
│ interface through which we can access ground truth, which is represented   │
│ by the condition of existing infrastructure and the experiences it         │
│ produces through user interactions. This is the set of information that    │
│ people remember from perception of the built environment.                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │ ▲
                                      ▼ │
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER SENSES                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ The 6 senses. All of the sensations that contribute to a user's mental     │
│ models of comfort, accessibility, and consistency. For those using wheeled │
│ mobility, this includes the feedback that riders receive from transport    │
│ devices like wheelchairs and skateboards. This is what Jacob Champlin's    │
│ Thesis modeled with its interviewing and scale making procedures. TRMCD5   │
│ Safety and Comfort. The practice of inputting and recording data will also │
│ affect how the user interprets the built environment.                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                        ▲
                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BUILT ENVIRONMENT                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ This is the ground truth of the built environment that we hope to compare  │
│ to and better predict with our Data Model.                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Contexts

- **Auth Context**: Wrapper for User Profiles
- **DataRanger Context**: Activates data ranger features
- **Tour Context**: Cycles between screens while feeding a series of Tour messages to the tour pop-up component. Powered by react-native-tourguide. Should have a secondary tour for when the activate dataranger mode toggle is switched.
-**Theme Context**: High Contrast Dark Mode/Light Mode

---

## Layouts

- **Basemap Layout**: Displays all user route and feature data and is the Default Slot Screen on top of which the home screen, active trip, trip summary, and trip history screens are built. Persistent Map View Component fills the full screen as the background layer. UI slots overlay the map: header slot at top, footer slot at bottom, secondary footer slot above the footer. Body slot fills the remaining space between header and secondary footer for screen-specific content that overlays the map (e.g., trip history cards, correction indicators). All slots are transparent by default, allowing the map to show through unless a screen adds opaque content.

---



## Screens

- **Log In Screen**: Calls on Auth Service to facilitate login or to sign up with the Create profile screen

- **Create Profile Screen**: Using Auth Service, asks for Age (limited to 18+), Display name (should have warning not to use identifying features), Password (with confirm password field), and Mode list. Includes Captcha functionality through Turnstile by Cloudflare. 

- **Profile Screen**: Should show a mode list that launches a modal (hook) that allows you to edit the user's mode list. Should show user summary statistics (average trip length, average trip duration, average feature rating (only if DataRanger context active), and average corrected segment (only if DataRanger context active)). Should have buttons to Logout, Delete all user data, Toggle DataRanger mode

- **Home Screen**: Built with Basemap layout. The bottom navigation bar component should show in the footer slot and a recenter button should show on the right side of the secondary footer slot. In the default home view, it displays all trip polyline data for a user using History service in a mapview component (with zoom set to the correct extent to encapsulate the data). In DataRanger mode, this should additionally display all user-contributed feature edits (rated/corrected) from the `feature_edits` table along trip polylines

-**Start Trip Screen**: Built with Basemap layout, uses start trip configuration of trip modal in bottom/drawer slot and route setting modal in top slot. If trip is started without setting a destination, go to active trip screen. If a route is selected using the route setting modal, go to the navigation screen.

- **Active Trip Screen**: Built with Basemap layout. Triggered by Start Trip Modal Component. Trip Pause and stop buttons in the bottom slot. When trip is ended, takes you to the trip summary screen for the trip that was just completed. In DataRanger mode, two collapsible tool panels appear on the right edge of the screen:

  **Rating Panel** (collapsed by default): When expanded, puts the map into rating mode. Tapping any point or line feature opens an attribute inspector (like the web editor's focus panel) integrated with existing modals. Users can view/edit feature attributes and contribute ratings (1-10 scale) for both point features (curb ramps, traffic calming) and line features (sidewalks, bikeways). Ratings and attribute edits are written to the `feature_edits` table.

  **Correction Panel** (collapsed by default): When expanded, reveals two sub-panels:

  1. **Point/Node Editor**: Allows moving, adding, and deleting point features using shared `@proximity/shared` tool state machines (move_point, add_node, delete_point tools). Uses `rnMapboxAdapter.ts` for feature queries, a gesture hook for converting RN touch events to MapTapEvent, and a "Confirm" button to call `handleToolFinish()` (replacing double-click on web). Tool status text displays at the top of the map.

  2. **Segment Corrector**: Allows the user to select a segment to correct, then record GPS route data to replace that segment's geometry. Trip Service notes the start GPS point when correction begins. A "Stop Correction" button appears in the secondary footer. When pressed, Trip Service notes the end GPS point and the polyline between those two points is written to the `feature_edits` table as a geometry correction associated with the selected segment's `street_grid_id`.

  The recenter button moves to the bottom right of the body slot while any correction tool is active

-**Navigation Screen**: Built with basemap layout, conatins active trip screen UI with navigation components instead of trip detail components. Should use the top and bottom navigation screen bars and have simple left right arrows that allow the user to manually toggle between the surface segment they are on in case of GPS inaccuracy. 

- **Trip Summary Screen**: Built with Basemap layout. Given a trip_id, calls on the history service to display relevant route and (if DataRanger on) feature data. Shows a trip history card in drawer format for the given trip_id in the footer slot of the homescreen

- **Trip History Screen**: Built with Basemap layout. Should have a list of trip summary cards in the body slot of the home screen and a profile button to launch the profile screen in the right of the header slot. The Map View Component should be frozen and dimmed

---





## Components

- **Map View Component**: Renders map tiles via MapBox Adapter and displays polylines and feature markers passed via props. Accepts props for map tiles, polylines array, features array, center position, interaction state (interactive, dimmed), and callbacks (onFeaturePress, onRecenter, onRegionDidChange). `onRegionDidChange` fires with the visible bounding box after the user pans/zooms, enabling viewport-based data loading. When a DataRanger tool is active, touch events are intercepted by the `useToolGesture` hook and routed to `handleToolTap()` instead of default map interactions. Defaults to centering on user's current GPS position via native adapter. Does not fetch data from services directly; screens are responsible for fetching data using services and passing it as props

- **Bottom Navigation Bar Component**: Record Button (Launches Start Trip Modal), Home Button (Launches home screen), History Button (Launches Trip History Screen)

- **Select Mode List Component**: Allows the user to select their preferred mode from a master list of modes (wheelchair, skateboard, assisted walking, walking, scooter). Can call on the auth service to edit the user's mode list

- **Trip Modal Component** (Launched by Bottom Navigation Bar): Four configuration modal that manages UI related to starting and ending trips as well as pre and post trip surveys. 

Start Trip Configuration: Asks for Mode from mode list, Comfort Level for that mode, Trip Purpose, then activates a start trip button. 

Orphaned Trip configuration: that prompts the user to end or resume their previous trip if the trip service detects a paused orphaned trip. 

Post Trip Configuration: When the end trip button is pressed on the active trip screen, before the trip summary screen opens, the user should be asked if they sucessfully reached their destination, and provide a trip completed status to the Trip Service to hand to the Database Adapter. 

Navigation Disclaimer Configuration: Should launch a disclaimer before navigation begins that indicates that navigation features are experimental and that users should trust their own senses and judgment above the app's recommendations. 

- **Trip History Card/Drawer Component**: Shows trip start time, mode, duration, and distance. Clicking it will open the trip summary screen for that trip. Using props based styling, the card can be displayed as a drawer for the trip summary screen. If DataRanger mode is on, it should also show the number of features rated or segments corrected

- **DataRanger Callout / Attribute Inspector**: Built for the active trip screen in rating mode. When a point or line feature is tapped, displays an attribute inspector panel (similar to the web editor's focus panel) showing all relevant attributes from the Proximity parquet schema. For point features: location description, condition score, intersection position, curb position, ramp slots. For line features: to_st, from_st, side of road, surface material, width, slope.

  Users can edit attribute values inline — only modified attributes are stored in `feature_edits`. A rating slider (1-10, default 5) allows contributing condition ratings. An "Upload Image" button allows camera or photo library uploads to the `feature_images` bucket. Supports both point and line features.

- **DataRanger Tool Panels**: Collapsible panels that appear on the right edge of the Active Trip Screen when DataRanger mode is active. Two top-level panels (Rating, Correction) with Correction containing two sub-panels (Point/Node Editor, Segment Corrector). Only one panel/tool can be active at a time. Panels show tool status text and subtype selectors when relevant.

- **Confirm Button Component**: Mobile replacement for double-click/Enter key. Appears when a multi-tap tool (draw_segment, merge_segments, add_polygon) needs finalization. Calls `handleToolFinish()` from `@proximity/shared`. Positioned at the bottom of the active tool panel.

- **rnMapboxAdapter.ts**: Implements the `MapAdapter` interface from `@proximity/shared` using `@rnmapbox/maps` APIs (`queryRenderedFeaturesAtPoint`, `queryRenderedFeaturesInRect`). Platform-specific bridge between RN Mapbox and the shared tool state machines.

- **useToolGesture Hook**: Converts React Native touch/press events from `@rnmapbox/maps` into `MapTapEvent` objects (`{ lng, lat }`) and calls `handleToolTap()` from `@proximity/shared`. Manages `ToolSessionState` across taps. Handles long-press for move_point drag initiation.

- **Tour Info Modal**: Configurable pop-up for each tour step to be overlayed on the screen below. Should also be used for tooltips where appropriate. 

- **Turnstile Captcha Component**: Uses react webview to implement cloudflare captcha functionality

-**Navigation Top Bar**: Contains informations about directions for the navigation screen

-**Navigation Bottom Bar**: Contains information about remaining trip time and distance, and an exit trip button

-**Route Selection Modal**: Should allow user to input origin and destination as an address which is passed to the navigation service. Users should be able to set either origin or destination to their current location and be able to swap origin and destination. 
---



## Services

- **Trip Service**: Write and display trip data. Checks that internet is connected and native adapter is active before trip starts. Receives GPS data from the native adapter, compiles it into polyline data for Active Trip Screen to pass to Map View Component via props for display during active trips, and hands it to the sync service which will eventually record to Supabase using the Supabase adapter. Should also use expo-device to store the device model and software version as a tuple to pass to the Database adapter when a trip is initialized. Trip time should be stored as relative time from when the start trip button is pressed. Only relative time, not absolute time, should be stored. Stores trips as encoded polylines. Trips should have a persistent state that starts when a trip is active and clears only after a trip and all features have been uploaded successfully. The persistent state should also be able to be set to paused. When the app or the home screen are opened, trip service should check for orphaned trips that are still active or paused. If an orphaned trip is active, it should be ended unless the user's location is within 200m of the last uploaded point in the trip. If an orphaned trip is paused, the start trip modal should ask the user if they want to end or resume the trip. After a trip is ended, the start trip modal is used to ask the user if they sucessfully reached their intended destination on their trip. 

In DataRanger mode, based on the mode that is selected for a trip, the DataRanger service should be called for feature data in the current viewport. Feature data should then be served to the active trip screen to hand to the map view component as a prop. When segment correction is activated through the Correction Panel's Segment Corrector, Trip Service should note the latest recorded GPS point. Once segment correction is ended through the "Stop Correction" button, Trip Service should note the last recorded GPS point. The polyline of GPS data recorded between those two points is served to the DataRanger service to write as a geometry correction in the `feature_edits` table with the selected segment's `street_grid_id`.

- **Sync Service**: This is the only place that raw GPS should ever be stored [THIS IS NOT TRUE BEFORE THE TIER 1 LEVEL 2 SIDEWALK CLIPPING ANONYMIZATION IS IMPLEMENTED]. Receives data from trip service and hands it to Supabase adapter to write trip data. Write buffer for interrupted trips if a trip was started with connectivity, connectivity was lost mid-trip, and the trip needs to finish recording locally until sync is possible. Caches raw GPS data for the first time a user views a trip summary screen. Once a trip has been synced successfully, the sync cache is cleared completely, removing all locally stored raw GPS data. The cache allows users to see their full unclipped route immediately after ending a trip, before server-side census block clipping modifies the geometry. Cached trips are stored with a synced flag - unsynced trips display cached data, synced trips fetch from server and clear the cache.

- **History Service**: Provides a list of trips for the active user with summary details to be displayed on cards for the trip history screen. Uses Database adapter to pull polyline and block data from Supabase tables and serve it to the trip summary and home screens which will then serve them to map view component as a prop.

- **DataRanger Service**: Initializes all DataRanger features and ensures the Proximity parquet is downloaded when DataRanger mode is on. Loads parquet data lazily by grid cell based on the map viewport bounding box (500m UTM cells, origin stored in parquet metadata). Checks for asset updates on app launch.

  **Viewport-based loading**: On the active trip screen, loads only the grid cells that overlap the current map viewport (via `onRegionDidChange` callback). On the home screen, loads only cells containing user-contributed edits. Uses `loadGridCellsForBbox(bbox)` and `loadGridCellsNearPoint(lat, lon, radius)` for spatial queries.

  **Feature edits**: Writes ratings, attribute corrections, geometry corrections, and images to the unified `feature_edits` table via Database adapter. Each edit stores only the `street_grid_id`, geometry, and modified attributes — not the full parquet row. Multiple users may submit different geometries for the same feature; each correction gets its own anonymous UUID row.

  **Tool integration**: Provides the `MapAdapter` implementation (`rnMapboxAdapter`) and `ToolCallbacks` bridge to the `@proximity/shared` tool state machines. Geometry edits from shared tools (move_point, add_node, delete_point, split_segment, merge_segments, draw_crosswalk) are submitted to the `geometry_edits` table with pending status and cached locally in AsyncStorage for preview.

  **Contribution history**: Uses Database adapter to provide user's edit history for Home Screen, Trip Summary Screen, and Profile Screen statistics.

-**Navigation Service**: Uses the Database adapter to query the Proximity spatial model from the Supabase Server to solicit route data from the precalculated graph. Pairs this data with GPS data the Native adapter to determine user's current location for routing. Uses orgin and destination from route setting modal to solicit route data from supabase using database adapter. Hands that route data to the mapview component and navigation screens to display. Route data should involve which surface the user is currently on, what the next recommended surface is, and any transitions that need to be made between surfaces. Using arrow UI on the navigation screen, the user should be able to correct the surface that they are autodetected as riding/walking on. 
---



## Adapters

- **MapBox Adapter**: Pull tile data from Mapbox and serve to Map View Component.

- **Native Adapter**: Handles all device permissions and native API interaction for GPS, Camera, and Photo Library access. Source of truth for GPS data, receives it from native API and serves it to trip service and serves it to Home, Active Trip, Trip Summary, and Trip History screens to use as a prop to pass to map view component. When app launches, check for whether location services have been allowed. Throws an error if GPS permissions are not granted or connection is lost

- **Database Adapter**: Layer of abstraction that allows for modularity in switching databases. This will be the Primary Source of Truth for interacting with the data model, which is currently stored on Supabase. All other services should use this service to interact with cloud data. Should be built with modularity in mind so that migrating to a different cloud database setup does not involve modifying other components. Should contain a series of functions that services and views can call to access data, and then functions that those functions call to access supabase. There should be 2 modules, an Auth Service for user and profile management that will be called on by the Auth Stack of screen, and a Data service that deals with trip, feature, and segment data for the main stack of screens.
    AuthService:
  - Includes an auth service that enables multi-device access via username/password without email collection
  - Two-layer authentication system combining local device security with Supabase anonymous authentication. When users create an account, they establish a username and password that are used for two purposes: local device access control and multi-device recovery credentials.
  - On account creation, the app generates a Supabase anonymous user (random UUID) and creates a corresponding profile. The username and Argon2-hashed password are stored locally in the device's secure storage, while recovery credentials (username + password hash) are stored server-side in the account_recovery table. The Supabase SDK automatically manages JWT tokens (access token and refresh token) for the anonymous user, storing them in AsyncStorage.
  - On device recovery, correct credentials trigger data migration: all trips and ratings are queried from existing tables and copied to a newly created anonymous user
  - No encrypted backups are stored—the recovery key simply proves ownership for data transfer between anonymous accounts
  - Through Supabase anonymous users, the adapter should have functions that allow profile screen to: Log In, Register, Get User, Logout, Delete all user data, Edit user data table using Supabase adapter (Toggle DataRanger mode, edit user mode list)
  -Manages Captcha functionality

  DataService:
  - Time of day and weekday or weekend (1 for weekdays, 0 for weekends and holidays) should be binned when trips are received from the trip service
    Time of Day Bins:
    - late_night:    00:00 - 05:00
    - early_morning: 05:00 - 07:00  
    - morning_rush:  07:00 - 10:00 
    - midday:        10:00 - 16:00
    - evening_rush:  16:00 - 19:00   
    - evening:       19:00 - 22:00
    - night:         22:00 - 24:00

  - Writes trip data to Supabase for Trip Service
  - Reads trip and block data for History Service
  - Writes feature edits (ratings, attribute corrections, geometry corrections) to `feature_edits` table for DataRanger Service
  - Writes geometry edits (topology operations) to `geometry_edits` table for DataRanger Service
  - Reads user's feature edits for contribution history (Home Screen, Profile statistics)
  - Uploads feature images to `feature-images` storage bucket

  **DataRanger Service**
  - Checks to see if Proximity parquet has been updated on Supabase since last download
  - Downloads parquet to filesystem cache; provides metadata (grid origin, cell size)

  **Navigation Service**
  - Checks for route data from precalculated route model on supabase
  - Relates route data fetched from server to locally stored street surface segment data for visualization
---



## Assets
*(# = Loaded locally when DataRanger Mode = On)*

Proximity parquet: Server-side parquet downloaded to device filesystem on DataRanger activation. Loaded lazily by 500m UTM grid cell based on viewport. Contains `proximity_grid_origin` metadata key (`{"x", "y", "cell_size"}`) for viewport-to-cell conversion.

@proximity/shared: NPM package containing shared tool state machines (`ToolId`, `ToolSessionState`, `ToolCallbacks`, `TOOL_STATUS`, `handleToolTap()`, `handleToolFinish()`), geometry utilities, `MapAdapter` interface, `MapTapEvent` type, and `GeometryEditType` types. Used by both the web county editor and RollTracks mobile.

## Supabase Tables

- **user_profiles**:
  - UUID
  - Display_name
  - age
  - mode_list
  - DataRanger_mode

- **trips** (GeoJSON):
  - Trip_ID
  - User_ID
  - Mode
  - Comfort
  - purpose
  - time_of_day
  - weekday 
  - duration_s
  - distance_mi
  - OD_geoids: Tuple(Origin, Destination)
  - device_version: Tuple(model, software version)
  - status
  - relativeTimes
  - geometry: Encoded Polyline

- **feature_edits** (Unified edit table mirroring parquet format):
  - id: UUID (anonymous, not linked to user identity after publish)
  - user_id: UUID (references auth.users)
  - trip_id: UUID (references trips)
  - street_grid_id: text (links to parquet segment/feature)
  - edit_type: text ('rating' | 'attribute_correction' | 'geometry_correction')
  - attributes: JSONB (only the edited attributes, sparse — not full row)
  - user_rating: integer (1-10, null if not a rating edit)
  - geometry: geometry(Geometry, 4326) (user-submitted geometry for corrections; multiple users may submit different geometries for the same feature, each with their own UUID row)
  - coord: geometry(Point, 4326) (edit location for spatial queries)
  - feature_type: text ('point' | 'line' — curb ramp vs sidewalk/bikeway)
  - created_at: timestamptz
  - Note: Multiple anonymous UUIDs may reference the same `street_grid_id` with different geometries — this supports multi-user correction averaging on the server side.

  **feature_images**
   - Links to feature_edits with storage_path pointing to Supabase bucket for image storage. Keep edit_id as foreign key. Store multiple images per edit.

- **geometry_edits** (Topology-altering operations requiring pipeline re-runs):
  - id: UUID
  - user_id: UUID (references auth.users)
  - trip_id: UUID (references trips)
  - edit_type: text ('move_endpoint' | 'add_node' | 'delete_point' | 'split_segment' | 'merge_segments' | 'draw_crosswalk')
  - street_grid_id: text
  - payload: JSONB (tool-specific data from @proximity/shared)
  - coord: geometry(Point, 4326)
  - status: text ('pending' | 'applied' | 'rejected' | 'conflict')
  - created_at: timestamptz
  - applied_at: timestamptz
  - applied_by: text (server process ID or admin)

-**account_recovery**
  -Username
  -password_hash
---

## Server Side Functions

-**OSM Notes API Adapter**: When geometry corrections in `feature_edits` reach sufficient confidence (multiple users), the averaged correction is sent as a Note through the OSM API. Coordinates for the note are extracted from the related street segment (via `street_grid_id` → parquet → `street_osmid`). The associated street OSMID (and separate sidewalk or cycletrack osmid) should be included in the note.

-**Pathfinding Service**: Uses pre-calculated routes between all intersections in the Proximity graph model to provide route data to the Navigation service. 

- **Segment Averaging & Correction Service**: Averages geometry corrections from `feature_edits` where multiple users have submitted different geometries for the same `street_grid_id`. Uses the aggregate centerline to correct the Proximity parquet segment and re-export. The more correction submissions that contribute to the average, the higher the confidence score (displayed as red→green color progression on mobile).

- **Route Anonymization and Publishing Service**: 2 tier, 4 level anonymization for route data. First tier happens to all server data, the second tier happens when data is published and exported. Prior to upload, the trip service also conducts anonymization through charecteristic binning and the use of relative rather than absolute time. The `feature_edits` table (geometry corrections) should be excluded from tier 2 level 1 sidewalk clipping anonymization to preserve accurate geometries. 

Tier 1 (uses PostgreSQL BEFORE INSERT triggers):
First level clips route data to exclude any of the route that is contained by the origin and destrination census blocks (as found in the blocks.geojson asset). Route data that is stored is between census blocks.

Tier 2:
Second level clips the route geometry to the stored sidewalk network. [DO NOT IMPLEMENT BEFORE sidewalks.json IS POPULATED. What about when People leave the sidewalk? USer flags, based off of GPS accuracy add buffer zone where if the user leaves the area of the width of the sidewalk the route is no longer clipped to the sidewalk network]

Third level uses a stochastic (greedy epsilon) Dijkstra's algorithm and OD pairs to create synthetic entries with the same descriptive statistics as trips that do not satisfy k-anoymity. The routes should be generated using an LTS weighted algorithm based on the tile 2 net sidewalk network with feature data used to calculate LTS.

Fourth level publishes route, rated feature, and sidewalk network data without UUIDs associated. 