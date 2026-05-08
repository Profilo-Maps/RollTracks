# RollCoin Integration with ParkXimity OSM Network Schema

## Overview

This document specifies how RollCoin tokens integrate with the ParkXimity OSM network correction system. Users earn tokens for validating and correcting the denormalized street/sidewalk/bikeway/crosswalk schema stored in Supabase.

---

## Contribution Types Aligned with OSM Schema

### 1. Curb Ramp Validation
**Target Fields**: `sidewalk_left/right_curbramp_start/end_X_condition_score`

**User Action**: 
- User walks past a curb ramp
- App shows existing condition score from CRIS data
- User rates condition (1-10 scale) and optionally uploads photo
- GPS location matched to nearest curb ramp slot

**Token Reward**: 1.0 base + quality bonuses
- GPS accuracy <5m: +0.2x
- Photo uploaded: +0.5 tokens
- Matches CRIS score (±1): +0.3x (validation bonus)
- Contradicts CRIS score (±3+): +0.5x (correction bonus)

**Database Update**:
```sql
-- Store user rating in contributions table
-- If consensus reached (3+ users agree), update:
UPDATE osm_network_segments
SET sidewalk_left_curbramp_start_1_condition_score = consensus_score
WHERE street_osmid = ? AND curbramp_locID = ?
```

---

### 2. Sidewalk Surface Correction
**Target Fields**: `sidewalk_left/right_surface`

**User Action**:
- User reports sidewalk surface material (concrete, asphalt, brick, gravel, dirt, etc.)
- App shows current OSM value (if available)
- User confirms or corrects

**Token Reward**: 1.5 base + quality bonuses
- GPS accuracy <5m: +0.3x
- Photo uploaded: +0.5 tokens
- Matches OSM data: +0.2x (validation)
- Corrects missing/wrong OSM data: +0.8x

**Database Update**:
```sql
UPDATE osm_network_segments
SET sidewalk_left_surface = user_reported_surface
WHERE street_osmid = ? AND ST_DWithin(sidewalk_left_geometry, user_location, 10)
```

---

### 3. Sidewalk Width Measurement
**Target Fields**: `sidewalk_left/right_width`

**User Action**:
- User measures sidewalk width using AR measurement tool or manual input
- App shows current OSM value (if available)

**Token Reward**: 2.0 base + quality bonuses
- GPS accuracy <5m: +0.4x
- Photo with measurement visible: +1.0 tokens
- Within 0.3m of OSM value: +0.3x (validation)
- Corrects missing/significantly wrong OSM: +1.0x

---

### 4. Crosswalk Feature Validation
**Target Fields**: `crosswalk_start/end_*` (type, marked, signals, tactile_paving, etc.)

**User Action**:
- User approaches crosswalk
- App shows checklist of features (marked, signals, button, sound, tactile paving, etc.)
- User confirms or corrects each feature

**Token Reward**: 1.0 base per feature + bonuses
- GPS accuracy <5m: +0.2x
- Photo uploaded: +0.5 tokens per feature
- Validates existing OSM data: +0.2x per feature
- Adds missing OSM data: +0.5x per feature

**Example**: User validates 5 crosswalk features (marked, signals, button, tactile_paving, island)
- Base: 5.0 tokens
- GPS bonus: +1.0 tokens
- Photo: +2.5 tokens
- Total: 8.5 tokens

---

### 5. Bikeway Type/Surface Correction
**Target Fields**: `bikeway_left/right_X_type`, `bikeway_left/right_X_surface`

**User Action**:
- User rides bike on bikeway
- App shows current OSM cycleway type (lane, track, shared_lane, etc.)
- User confirms or corrects type and surface

**Token Reward**: 1.5 base + quality bonuses
- GPS accuracy <5m: +0.3x
- Photo uploaded: +0.5 tokens
- Validates OSM data: +0.3x
- Corrects OSM data: +0.8x

---

### 6. Street Feature Reporting
**Target Fields**: `street/sidewalk/bikeway_*_feature_types`, `*_feature_geometry`

**User Action**:
- User reports obstacle or feature (pothole, construction, tree, bench, etc.)
- GPS location stored in multipoint geometry
- Feature type added to parallel list

**Token Reward**: 0.5 base per feature + bonuses
- GPS accuracy <5m: +0.2x
- Photo uploaded: +0.5 tokens
- Verified by 2+ users: +0.5x

**Database Update**:
```sql
-- Append to multipoint geometry and feature type list
UPDATE osm_network_segments
SET 
  sidewalk_left_feature_types = array_append(sidewalk_left_feature_types, 'pothole'),
  sidewalk_left_feature_geometry = ST_AddPoint(sidewalk_left_feature_geometry, user_location),
  sidewalk_left_feature_geometry_projected = ST_AddPoint(
    sidewalk_left_feature_geometry_projected, 
    ST_ClosestPoint(sidewalk_left_geometry, user_location)
  )
WHERE street_osmid = ?
```

---

### 7. Geometry Correction (Advanced)
**Target Fields**: `sidewalk_left/right_geometry`, `bikeway_*_geometry`

**User Action**:
- User traces actual sidewalk/bikeway path using GPS tracking
- App compares to existing geometry
- If deviation >2m, user can submit correction

**Token Reward**: 3.0 base + quality bonuses
- GPS accuracy <5m throughout trace: +1.0x
- Trace length >50m: +1.0 tokens
- Verified by 2+ users: +2.0x

**Database Update**:
```sql
-- Store proposed geometry in contributions table
-- After peer validation, update:
UPDATE osm_network_segments
SET sidewalk_left_geometry = corrected_geometry
WHERE street_osmid = ?
```

---

### 8. OSM Note Submission
**Target Fields**: All fields (submits corrections to OpenStreetMap)

**User Action**:
- User submits validated correction to OSM via Notes API
- App formats note with proper OSM tags and references

**Token Reward**: 3.0 base + acceptance bonus
- Note submitted: 3.0 tokens
- Note accepted by OSM moderator: +6.0 tokens (2x bonus)
- Note marked resolved: +3.0 tokens additional

**OSM Note Format**:
```
User correction via ParkXimity RollTracks:
Street: [name] (OSM ID: [street_osmid])
Field: sidewalk:left:surface
Current: concrete
Proposed: asphalt
GPS Accuracy: 3.2m
Photo: [supabase_storage_url]
Validated by: 3 users
```

---

## Updated Database Schema

### Contributions Table (Enhanced)

```sql
CREATE TABLE public.contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Contribution type aligned with OSM schema
    contribution_type TEXT NOT NULL CHECK (contribution_type IN (
        'curb_ramp_validation',
        'sidewalk_surface_correction',
        'sidewalk_width_measurement',
        'crosswalk_feature_validation',
        'bikeway_correction',
        'street_feature_report',
        'geometry_correction',
        'osm_note_submission'
    )),
    
    -- Reference to OSM network segment
    street_osmid BIGINT NOT NULL, -- FK to osm_network_segments
    
    -- Specific field being corrected
    field_name TEXT NOT NULL, -- e.g., 'sidewalk_left_surface', 'crosswalk_start_marked'
    
    -- Old and new values
    old_value TEXT,
    new_value TEXT NOT NULL,
    
    -- Geometry data (for location-based contributions)
    contribution_geometry GEOGRAPHY(POINT, 4326),
    gps_accuracy_meters DECIMAL(5,2),
    
    -- Photo evidence
    photo_url TEXT,
    photo_size_bytes INTEGER,
    
    -- Validation status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'approved',
        'rejected',
        'disputed'
    )),
    
    -- Token value
    token_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- Validation metadata
    validation_method TEXT CHECK (validation_method IN (
        'auto',
        'peer',
        'expert',
        'osm_accepted'
    )),
    peer_validation_count INTEGER DEFAULT 0,
    peer_approval_count INTEGER DEFAULT 0,
    
    -- OSM submission tracking
    osm_note_id BIGINT,
    osm_note_status TEXT CHECK (osm_note_status IN (
        'open',
        'closed',
        'resolved'
    )),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    osm_submitted_at TIMESTAMPTZ,
    osm_resolved_at TIMESTAMPTZ,
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_contributions_street_osmid ON public.contributions(street_osmid);
CREATE INDEX idx_contributions_field_name ON public.contributions(field_name);
CREATE INDEX idx_contributions_status ON public.contributions(status);
CREATE INDEX idx_contributions_osm_note_id ON public.contributions(osm_note_id) WHERE osm_note_id IS NOT NULL;
```

---

### Token Rewards Config (Updated)

```sql
INSERT INTO public.token_rewards_config (contribution_type, base_reward, quality_multiplier_min, quality_multiplier_max) VALUES
    ('curb_ramp_validation', 1.0, 0.8, 1.5),
    ('sidewalk_surface_correction', 1.5, 0.8, 2.0),
    ('sidewalk_width_measurement', 2.0, 0.8, 2.5),
    ('crosswalk_feature_validation', 1.0, 0.8, 1.5), -- per feature
    ('bikeway_correction', 1.5, 0.8, 2.0),
    ('street_feature_report', 0.5, 0.8, 1.3),
    ('geometry_correction', 3.0, 0.8, 3.0),
    ('osm_note_submission', 3.0, 1.0, 3.0) -- bonus awarded separately on acceptance
ON CONFLICT (contribution_type) DO UPDATE SET
    base_reward = EXCLUDED.base_reward,
    quality_multiplier_min = EXCLUDED.quality_multiplier_min,
    quality_multiplier_max = EXCLUDED.quality_multiplier_max;
```

---

## Integration with OSM Network Segments Table

### Assumed Supabase Table Structure

```sql
CREATE TABLE public.osm_network_segments (
    street_osmid BIGINT PRIMARY KEY,
    name TEXT,
    highway TEXT,
    
    -- Sidewalk left fields
    sidewalk_left_presence BOOLEAN,
    sidewalk_left_surface TEXT,
    sidewalk_left_width DECIMAL(4,2),
    sidewalk_left_incline DECIMAL(4,2),
    
    -- Curb ramps (6 slots: start_1/2/3, end_1/2/3)
    sidewalk_left_curbramp_start_1_locID TEXT,
    sidewalk_left_curbramp_start_1_condition_score INTEGER,
    sidewalk_left_curbramp_start_1_geometry GEOGRAPHY(POINT, 4326),
    -- ... (repeat for start_2, start_3, end_1, end_2, end_3)
    
    -- Features (multipoint + parallel array)
    sidewalk_left_feature_types TEXT[],
    sidewalk_left_feature_geometry GEOGRAPHY(MULTIPOINT, 4326),
    sidewalk_left_feature_geometry_projected GEOGRAPHY(MULTIPOINT, 4326),
    
    -- Sidewalk right (mirror of left)
    sidewalk_right_presence BOOLEAN,
    sidewalk_right_surface TEXT,
    -- ... (all right-side fields)
    
    -- Crosswalks
    crosswalk_start_type TEXT,
    crosswalk_start_marked BOOLEAN,
    crosswalk_start_signals TEXT[],
    crosswalk_start_tactile_paving BOOLEAN,
    crosswalk_start_geometry GEOGRAPHY(LINESTRING, 4326),
    -- ... (all start fields)
    
    crosswalk_end_type TEXT,
    -- ... (all end fields)
    
    -- Bikeways (up to 2 per side)
    bikeway_left_1_type TEXT,
    bikeway_left_1_surface TEXT,
    bikeway_left_1_width DECIMAL(4,2),
    bikeway_left_1_feature_types TEXT[],
    bikeway_left_1_feature_geometry GEOGRAPHY(MULTIPOINT, 4326),
    -- ... (left_2, right_1, right_2)
    
    -- Geometries
    street_geometry GEOGRAPHY(LINESTRING, 4326),
    sidewalk_left_geometry GEOGRAPHY(LINESTRING, 4326),
    sidewalk_right_geometry GEOGRAPHY(LINESTRING, 4326),
    curb_return_end_geometry GEOGRAPHY(LINESTRING, 4326),
    bikeway_left_1_geometry GEOGRAPHY(LINESTRING, 4326),
    -- ... (other geometries)
    
    -- Metadata
    last_updated TIMESTAMPTZ DEFAULT now(),
    data_quality_score DECIMAL(3,2) DEFAULT 0.5, -- 0-1 scale based on validation count
    validation_count INTEGER DEFAULT 0
);

CREATE INDEX idx_osm_segments_geometry ON public.osm_network_segments USING GIST(street_geometry);
CREATE INDEX idx_osm_segments_sidewalk_left ON public.osm_network_segments USING GIST(sidewalk_left_geometry);
CREATE INDEX idx_osm_segments_sidewalk_right ON public.osm_network_segments USING GIST(sidewalk_right_geometry);
```

---

## Validation Workflow for OSM Corrections

### Tier 1: Automated Validation

```sql
CREATE OR REPLACE FUNCTION public.validate_osm_contribution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_base_reward DECIMAL(10,2);
    v_quality_multiplier DECIMAL(3,2);
    v_final_reward DECIMAL(10,2);
    v_existing_value TEXT;
BEGIN
    -- Get base reward
    SELECT base_reward INTO v_base_reward
    FROM public.token_rewards_config
    WHERE contribution_type = NEW.contribution_type;
    
    v_quality_multiplier := 1.0;
    
    -- GPS accuracy bonus
    IF NEW.gps_accuracy_meters IS NOT NULL THEN
        IF NEW.gps_accuracy_meters < 5 THEN
            v_quality_multiplier := v_quality_multiplier * 1.3;
        ELSIF NEW.gps_accuracy_meters > 10 THEN
            v_quality_multiplier := v_quality_multiplier * 0.8;
        END IF;
    END IF;
    
    -- Photo bonus
    IF NEW.photo_url IS NOT NULL THEN
        NEW.token_value := NEW.token_value + 0.5;
        IF NEW.photo_size_bytes > 2000000 THEN
            v_quality_multiplier := v_quality_multiplier * 1.2;
        END IF;
    END IF;
    
    -- Check if this validates or corrects existing data
    -- (This would query osm_network_segments to compare old_value)
    IF NEW.old_value IS NOT NULL AND NEW.old_value = NEW.new_value THEN
        -- Validation (confirms existing data)
        v_quality_multiplier := v_quality_multiplier * 1.2;
    ELSIF NEW.old_value IS NULL OR NEW.old_value = '' THEN
        -- Adding missing data
        v_quality_multiplier := v_quality_multiplier * 1.5;
    ELSE
        -- Correction (changes existing data)
        v_quality_multiplier := v_quality_multiplier * 1.3;
    END IF;
    
    -- Calculate final reward
    v_final_reward := v_base_reward * v_quality_multiplier;
    
    -- Auto-approve if quality is good
    IF v_quality_multiplier >= 1.0 AND NEW.gps_accuracy_meters < 10 THEN
        NEW.status := 'approved';
        NEW.approved_at := now();
        NEW.token_value := v_final_reward;
        NEW.validation_method := 'auto';
        
        -- Award 50% tokens immediately
        PERFORM public.award_tokens(
            NEW.user_id,
            v_final_reward * 0.5,
            NEW.id,
            'Auto-approved (50%): ' || NEW.contribution_type
        );
        
        -- Remaining 50% awarded after peer validation
    ELSE
        NEW.status := 'pending';
        NEW.token_value := v_final_reward;
    END IF;
    
    RETURN NEW;
END;
$$;
```

### Tier 2: Peer Validation

When 3+ users validate the same field on the same segment:

```sql
CREATE OR REPLACE FUNCTION public.check_peer_consensus(p_contribution_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_contribution RECORD;
    v_consensus_value TEXT;
    v_consensus_count INTEGER;
    v_total_validations INTEGER;
BEGIN
    -- Get contribution details
    SELECT * INTO v_contribution
    FROM public.contributions
    WHERE id = p_contribution_id;
    
    -- Count validations for same field on same segment
    SELECT 
        new_value,
        COUNT(*) as count
    INTO v_consensus_value, v_consensus_count
    FROM public.contributions
    WHERE street_osmid = v_contribution.street_osmid
      AND field_name = v_contribution.field_name
      AND status = 'approved'
      AND created_at > now() - INTERVAL '30 days'
    GROUP BY new_value
    ORDER BY COUNT(*) DESC
    LIMIT 1;
    
    SELECT COUNT(*) INTO v_total_validations
    FROM public.contributions
    WHERE street_osmid = v_contribution.street_osmid
      AND field_name = v_contribution.field_name
      AND status = 'approved'
      AND created_at > now() - INTERVAL '30 days';
    
    -- If consensus reached (60%+ agreement, min 3 validations)
    IF v_total_validations >= 3 AND 
       v_consensus_count::DECIMAL / v_total_validations >= 0.6 THEN
        
        -- Update OSM network segment
        EXECUTE format(
            'UPDATE public.osm_network_segments SET %I = $1, validation_count = validation_count + 1 WHERE street_osmid = $2',
            v_contribution.field_name
        ) USING v_consensus_value, v_contribution.street_osmid;
        
        -- Award remaining 50% tokens to all contributors in consensus
        UPDATE public.contributions
        SET 
            status = 'approved',
            approved_at = now(),
            validation_method = 'peer'
        WHERE street_osmid = v_contribution.street_osmid
          AND field_name = v_contribution.field_name
          AND new_value = v_consensus_value
          AND status = 'pending';
        
        -- Award tokens
        PERFORM public.award_tokens(
            user_id,
            token_value * 0.5,
            id,
            'Peer consensus reached (50%)'
        )
        FROM public.contributions
        WHERE street_osmid = v_contribution.street_osmid
          AND field_name = v_contribution.field_name
          AND new_value = v_consensus_value;
    END IF;
END;
$$;
```

---

## App Integration Points

### 1. DataRanger Service Enhancement

```typescript
// When user validates curb ramp
async validateCurbRamp(
  streetOsmId: bigint,
  curbRampSlot: 'sidewalk_left_curbramp_start_1' | ...,
  conditionScore: number,
  gpsAccuracy: number,
  photoUrl?: string
) {
  const { data: segment } = await supabase
    .from('osm_network_segments')
    .select(`${curbRampSlot}_condition_score`)
    .eq('street_osmid', streetOsmId)
    .single();
  
  const oldValue = segment?.[`${curbRampSlot}_condition_score`]?.toString();
  
  await supabase.from('contributions').insert({
    user_id: this.userId,
    contribution_type: 'curb_ramp_validation',
    street_osmid: streetOsmId,
    field_name: `${curbRampSlot}_condition_score`,
    old_value: oldValue,
    new_value: conditionScore.toString(),
    contribution_geometry: `POINT(${lon} ${lat})`,
    gps_accuracy_meters: gpsAccuracy,
    photo_url: photoUrl,
    photo_size_bytes: photoUrl ? await this.getPhotoSize(photoUrl) : null
  });
  
  // Tokens auto-awarded by trigger!
}
```

### 2. New UI Screens

**OSM Correction Screen**:
- Shows current OSM data for nearby segment
- Allows user to confirm or correct each field
- Displays token rewards for each correction type
- Shows validation status (pending/approved)

**Contribution History Screen**:
- Lists all user contributions with status
- Shows tokens earned per contribution
- Displays consensus status (e.g., "2/3 validators agree")
- Links to OSM notes if submitted

---

## Success Metrics

### Data Quality Improvement
- 80%+ of segments have validated sidewalk surface data
- 60%+ of curb ramps have 3+ condition validations
- 50%+ of crosswalks have complete feature data

### User Engagement
- 100+ active contributors per month
- 1,000+ validations per month
- 50+ OSM notes submitted per month
- 70%+ OSM note acceptance rate

### Token Economics
- Average 5-10 tokens earned per active session
- 30%+ token redemption rate
- Positive correlation between token rewards and data quality

---

## Next Steps

1. **Create osm_network_segments table** in Supabase (if not exists)
2. **Run updated migration** with OSM-specific contribution types
3. **Update DataRanger Service** to create contributions for each validation type
4. **Build OSM Correction UI** in React Native app
5. **Implement OSM Notes API integration** for Phase 3
6. **Set up peer validation workflow** for Phase 2

---

**Document Version**: 1.0  
**Last Updated**: February 18, 2026  
**Integration Target**: ParkXimity OSM Network Schema
