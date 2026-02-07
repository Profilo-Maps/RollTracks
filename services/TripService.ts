// TripService: Write and display trip data
// TODO: Implement trip service with:
// - Check internet connection and GPS adapter before trip starts
// - Receive GPS data from GPS Adapter
// - Compile GPS data into polyline data (Mapbox Polyline format)
// - Serve polylines to Active Trip Screen for MapView props
// - Hand data to Sync Service for Supabase recording
// - Persistent trip state (active/paused/cleared)
// - Orphaned trip detection on app/home screen open
//   - End active orphaned if user >200m from last point
//   - Prompt for paused orphaned trips
// - In DataRanger mode: call DataRanger service for obstacle/segment data
// - Segment correction tracking (start/end GPS points, corrected segments list)
// - Serve corrected segments to DataRanger service

