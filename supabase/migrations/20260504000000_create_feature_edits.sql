-- Unified feature edits table consolidating ratings, attribute corrections, and geometry corrections
-- Mirrors parquet format: stores street_grid_id, geometry, and only edited attributes (sparse)
-- Multiple users may submit different geometries for the same feature (multi-user averaging)

create table feature_edits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  trip_id uuid references trips(trip_id),
  street_grid_id text not null,
  edit_type text not null check (edit_type in ('rating', 'attribute_correction', 'geometry_correction')),
  attributes jsonb default '{}',
  user_rating integer check (user_rating >= 1 and user_rating <= 10),
  geometry geometry(Geometry, 4326),
  coord geometry(Point, 4326) not null,
  feature_type text not null check (feature_type in ('point', 'line')),
  created_at timestamptz default now()
);

-- Indexes
create index idx_feature_edits_user on feature_edits(user_id);
create index idx_feature_edits_trip on feature_edits(trip_id);
create index idx_feature_edits_grid_id on feature_edits(street_grid_id);
create index idx_feature_edits_coord on feature_edits using gist(coord);
create index idx_feature_edits_type on feature_edits(edit_type);

-- RLS policies
alter table feature_edits enable row level security;

create policy "Users can insert their own feature edits"
  on feature_edits for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own feature edits"
  on feature_edits for select
  using (auth.uid() = user_id);

create policy "Users can update their own feature edits"
  on feature_edits for update
  using (auth.uid() = user_id);
