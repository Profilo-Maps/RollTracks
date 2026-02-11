# Product Overview

RollTracks is a privacy-first route sharing platform for non-car transport users, with a focus on wheelchair users, skateboarders, and other travelers sensitive to ADA compliance.

## Core Purpose

Create an anonymized, open dataset of non-car transport activity for routing and traffic modeling analysis. The app helps develop wheelchair and skateboard-specific models of Level of Traffic Stress for better urban design integration.

## Key Features

- **Trip Recording**: Track and record user routes with mode, comfort level, and trip purpose
- **Post-Trip Survey**: After each trip, users answer "Did you reach your destination?" to help analyze trip completion rates and routing effectiveness
- **Privacy-First Architecture**:
  - Anonymous Supabase accounts with username/password recovery (no email collection)
  - Time-binned data storage (7 time-of-day bins + weekday/weekend indicator)
  - Relative timestamps in GPS tracks (prevents exact trip timing reconstruction)
  - Server-side census block clipping removes trip origins and destinations
- **Multi-Device Support**: Data migration between devices using recovery credentials
- **Offline Capability**: Local trip buffering with automatic sync when connectivity returns

## User Modes

Wheelchair, skateboard, assisted walking, walking, scooter

## Data Collection

- Route polylines with GPS tracking and relative timestamps
- Trip metadata (mode, comfort, purpose, duration, distance, completion status)
- Device and software version tracking (platform, OS version, app version)
- Privacy-preserving binned temporal data (time-of-day bins, weekday/weekend indicator)
