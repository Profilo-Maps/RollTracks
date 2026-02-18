-- Add time_stamp column as alias for timestamp column
-- This maintains backward compatibility while supporting new code

ALTER TABLE rated_features 
ADD COLUMN IF NOT EXISTS time_stamp TIMESTAMPTZ;

-- Copy existing timestamp values to time_stamp
UPDATE rated_features 
SET time_stamp = timestamp 
WHERE time_stamp IS NULL;

-- Set default for new rows
ALTER TABLE rated_features 
ALTER COLUMN time_stamp SET DEFAULT NOW();

COMMENT ON COLUMN rated_features.time_stamp IS 'When the rating was recorded (duplicate of timestamp for compatibility)';;
