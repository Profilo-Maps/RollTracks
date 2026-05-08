-- RollCoin MVP: Minimal Token System Setup for ParkXimity OSM Network
-- Phase 1: Token ledger with automated validation only
-- 
-- NOTE: This migration is ready to deploy but kept in prompts folder until
-- osm_network_segments table is finalized. Move to supabase/migrations/ when ready.

-- ============================================================================
-- 1. CONTRIBUTIONS TABLE (OSM Network Schema Aligned)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
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

CREATE INDEX idx_contributions_user_id ON public.contributions(user_id);
CREATE INDEX idx_contributions_street_osmid ON public.contributions(street_osmid);
CREATE INDEX idx_contributions_field_name ON public.contributions(field_name);
CREATE INDEX idx_contributions_status ON public.contributions(status);
CREATE INDEX idx_contributions_created_at ON public.contributions(created_at DESC);
CREATE INDEX idx_contributions_osm_note_id ON public.contributions(osm_note_id) WHERE osm_note_id IS NOT NULL;
CREATE INDEX idx_contributions_geometry ON public.contributions USING GIST(contribution_geometry);

-- ============================================================================
-- 2. TOKEN LEDGER TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.token_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Transaction details
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'earn',
        'spend',
        'adjustment'
    )),
    
    amount DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    
    -- Link to contribution that earned these tokens
    contribution_id UUID REFERENCES public.contributions(id) ON DELETE SET NULL,
    
    -- Optional description
    description TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_token_ledger_user_id ON public.token_ledger(user_id);
CREATE INDEX idx_token_ledger_created_at ON public.token_ledger(created_at DESC);

-- ============================================================================
-- 3. TOKEN REWARDS CONFIG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.token_rewards_config (
    contribution_type TEXT PRIMARY KEY,
    base_reward DECIMAL(10,2) NOT NULL,
    quality_multiplier_min DECIMAL(3,2) NOT NULL DEFAULT 0.8,
    quality_multiplier_max DECIMAL(3,2) NOT NULL DEFAULT 1.5,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default reward values aligned with OSM contribution types
INSERT INTO public.token_rewards_config (contribution_type, base_reward, quality_multiplier_min, quality_multiplier_max) VALUES
    ('curb_ramp_validation', 1.0, 0.8, 1.5),
    ('sidewalk_surface_correction', 1.5, 0.8, 2.0),
    ('sidewalk_width_measurement', 2.0, 0.8, 2.5),
    ('crosswalk_feature_validation', 1.0, 0.8, 1.5),
    ('bikeway_correction', 1.5, 0.8, 2.0),
    ('street_feature_report', 0.5, 0.8, 1.3),
    ('geometry_correction', 3.0, 0.8, 3.0),
    ('osm_note_submission', 3.0, 1.0, 3.0)
ON CONFLICT (contribution_type) DO UPDATE SET
    base_reward = EXCLUDED.base_reward,
    quality_multiplier_min = EXCLUDED.quality_multiplier_min,
    quality_multiplier_max = EXCLUDED.quality_multiplier_max;

-- ============================================================================
-- 4. ADD TOKEN BALANCE TO USER PROFILES
-- ============================================================================
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS token_balance DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE INDEX idx_user_profiles_token_balance ON public.user_profiles(token_balance DESC);

-- ============================================================================
-- 5. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_rewards_config ENABLE ROW LEVEL SECURITY;

-- Contributions: Users can read their own, service role can write
CREATE POLICY "Users can view own contributions"
    ON public.contributions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert contributions"
    ON public.contributions FOR INSERT
    WITH CHECK (true); -- Edge functions use service role

CREATE POLICY "Service role can update contributions"
    ON public.contributions FOR UPDATE
    USING (true);

-- Token Ledger: Users can read their own, service role can write
CREATE POLICY "Users can view own token transactions"
    ON public.token_ledger FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert token transactions"
    ON public.token_ledger FOR INSERT
    WITH CHECK (true);

-- Token Rewards Config: Everyone can read, only service role can write
CREATE POLICY "Anyone can view token rewards config"
    ON public.token_rewards_config FOR SELECT
    USING (true);

CREATE POLICY "Service role can update token rewards config"
    ON public.token_rewards_config FOR UPDATE
    USING (true);

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to get user's current token balance
CREATE OR REPLACE FUNCTION public.get_token_balance(p_user_id UUID)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_balance DECIMAL(10,2);
BEGIN
    SELECT token_balance INTO v_balance
    FROM public.user_profiles
    WHERE id = p_user_id;
    
    RETURN COALESCE(v_balance, 0);
END;
$$;

-- Function to award tokens (called by Edge Function)
CREATE OR REPLACE FUNCTION public.award_tokens(
    p_user_id UUID,
    p_amount DECIMAL(10,2),
    p_contribution_id UUID,
    p_description TEXT DEFAULT NULL
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_new_balance DECIMAL(10,2);
BEGIN
    -- Update user's token balance
    UPDATE public.user_profiles
    SET token_balance = token_balance + p_amount
    WHERE id = p_user_id
    RETURNING token_balance INTO v_new_balance;
    
    -- Record transaction in ledger
    INSERT INTO public.token_ledger (
        user_id,
        transaction_type,
        amount,
        balance_after,
        contribution_id,
        description
    ) VALUES (
        p_user_id,
        'earn',
        p_amount,
        v_new_balance,
        p_contribution_id,
        p_description
    );
    
    RETURN v_new_balance;
END;
$$;

-- ============================================================================
-- 7. AUTOMATED VALIDATION TRIGGER (OSM-Specific)
-- ============================================================================

-- Function to auto-validate OSM contributions and award tokens
CREATE OR REPLACE FUNCTION public.auto_validate_osm_contribution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_base_reward DECIMAL(10,2);
    v_quality_multiplier DECIMAL(3,2);
    v_final_reward DECIMAL(10,2);
BEGIN
    -- Get base reward for this contribution type
    SELECT base_reward INTO v_base_reward
    FROM public.token_rewards_config
    WHERE contribution_type = NEW.contribution_type;
    
    -- Calculate quality multiplier based on metadata
    v_quality_multiplier := 1.0;
    
    -- GPS accuracy bonus/penalty
    IF NEW.gps_accuracy_meters IS NOT NULL THEN
        IF NEW.gps_accuracy_meters < 5 THEN
            v_quality_multiplier := v_quality_multiplier * 1.3;
        ELSIF NEW.gps_accuracy_meters BETWEEN 5 AND 10 THEN
            v_quality_multiplier := v_quality_multiplier * 1.0;
        ELSE
            v_quality_multiplier := v_quality_multiplier * 0.8;
        END IF;
    END IF;
    
    -- Photo quality bonus
    IF NEW.photo_url IS NOT NULL THEN
        -- Base photo bonus
        v_final_reward := COALESCE(v_final_reward, 0) + 0.5;
        
        -- High quality photo bonus
        IF NEW.photo_size_bytes > 2000000 THEN -- >2MB
            v_quality_multiplier := v_quality_multiplier * 1.2;
        END IF;
    END IF;
    
    -- Data validation vs correction bonus
    IF NEW.old_value IS NOT NULL AND NEW.old_value != '' THEN
        IF NEW.old_value = NEW.new_value THEN
            -- Validation (confirms existing data)
            v_quality_multiplier := v_quality_multiplier * 1.2;
        ELSE
            -- Correction (changes existing data)
            v_quality_multiplier := v_quality_multiplier * 1.3;
        END IF;
    ELSE
        -- Adding missing data
        v_quality_multiplier := v_quality_multiplier * 1.5;
    END IF;
    
    -- Calculate final reward
    v_final_reward := COALESCE(v_final_reward, 0) + (v_base_reward * v_quality_multiplier);
    
    -- Auto-approve if quality is good
    IF v_quality_multiplier >= 1.0 AND (NEW.gps_accuracy_meters IS NULL OR NEW.gps_accuracy_meters < 10) THEN
        NEW.status := 'approved';
        NEW.approved_at := now();
        NEW.token_value := v_final_reward;
        NEW.validation_method := 'auto';
        
        -- Award 50% tokens immediately (remaining 50% after peer validation)
        PERFORM public.award_tokens(
            NEW.user_id,
            v_final_reward * 0.5,
            NEW.id,
            'Auto-approved (50%): ' || NEW.contribution_type || ' - ' || NEW.field_name
        );
    ELSE
        -- Pending peer validation
        NEW.status := 'pending';
        NEW.token_value := v_final_reward;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_validate_osm_contribution ON public.contributions;
CREATE TRIGGER trigger_auto_validate_osm_contribution
    BEFORE INSERT ON public.contributions
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_validate_osm_contribution();

-- ============================================================================
-- 8. PEER CONSENSUS FUNCTION (For Phase 2)
-- ============================================================================

-- Function to check if peer consensus is reached and update OSM data
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
        
        -- Update OSM network segment (if table exists)
        -- Note: Uncomment when osm_network_segments table is created
        /*
        EXECUTE format(
            'UPDATE public.osm_network_segments SET %I = $1, validation_count = validation_count + 1 WHERE street_osmid = $2',
            v_contribution.field_name
        ) USING v_consensus_value, v_contribution.street_osmid;
        */
        
        -- Award remaining 50% tokens to all contributors in consensus
        PERFORM public.award_tokens(
            user_id,
            token_value * 0.5,
            id,
            'Peer consensus reached (50%): ' || field_name
        )
        FROM public.contributions
        WHERE street_osmid = v_contribution.street_osmid
          AND field_name = v_contribution.field_name
          AND new_value = v_consensus_value
          AND status = 'approved'
          AND validation_method = 'auto'; -- Only award to those who got 50% already
    END IF;
END;
$$;

-- ============================================================================
-- DONE! 
-- ============================================================================
-- Next steps:
-- 1. Move this file to supabase/migrations/ when osm_network_segments is ready
-- 2. Run migration: supabase db push
-- 3. Create osm_network_segments table (see RollCoin_ParkXimity_Integration.md)
-- 4. Update DataRanger Service to create OSM-specific contribution records
-- 5. Add token balance display to Profile Screen
-- 6. Add OSM correction UI to show nearby segments and allow field corrections
-- 7. Implement peer validation workflow (Phase 2)
-- 8. Integrate OSM Notes API (Phase 3)

-- Example usage in app:
/*
-- When user validates a curb ramp condition score:
INSERT INTO contributions (
    user_id,
    contribution_type,
    street_osmid,
    field_name,
    old_value,
    new_value,
    contribution_geometry,
    gps_accuracy_meters,
    photo_url,
    photo_size_bytes
) VALUES (
    auth.uid(),
    'curb_ramp_validation',
    123456789,
    'sidewalk_left_curbramp_start_1_condition_score',
    '7',
    '5',
    ST_GeogFromText('POINT(-122.4194 37.7749)'),
    3.2,
    'https://storage.supabase.co/...',
    2500000
);
-- Tokens automatically awarded by trigger!

-- When user corrects sidewalk surface:
INSERT INTO contributions (
    user_id,
    contribution_type,
    street_osmid,
    field_name,
    old_value,
    new_value,
    contribution_geometry,
    gps_accuracy_meters
) VALUES (
    auth.uid(),
    'sidewalk_surface_correction',
    123456789,
    'sidewalk_left_surface',
    'concrete',
    'asphalt',
    ST_GeogFromText('POINT(-122.4194 37.7749)'),
    4.1
);

-- Check peer consensus after 3+ validations:
SELECT check_peer_consensus(contribution_id);
*/
