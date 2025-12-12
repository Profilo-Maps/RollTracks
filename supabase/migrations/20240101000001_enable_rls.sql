-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_uploads ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
CREATE POLICY "Users can view own profile" 
  ON profiles FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = user_id);

-- Trips RLS Policies
CREATE POLICY "Users can view own trips" 
  ON trips FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trips" 
  ON trips FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trips" 
  ON trips FOR UPDATE 
  USING (auth.uid() = user_id);

-- Trip uploads RLS Policies
CREATE POLICY "Users can view own uploads" 
  ON trip_uploads FOR SELECT 
  USING (auth.uid() IN (SELECT user_id FROM trips WHERE id = trip_id));

CREATE POLICY "Users can insert own uploads" 
  ON trip_uploads FOR INSERT 
  WITH CHECK (auth.uid() IN (SELECT user_id FROM trips WHERE id = trip_id));
