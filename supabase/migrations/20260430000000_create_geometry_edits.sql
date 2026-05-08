-- Geometry edits table for topology-altering operations submitted from mobile
-- These edits require server-side pipeline re-runs to apply to the Proximity parquet

create table geometry_edits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  trip_id uuid references trips(trip_id),
  edit_type text not null,
  street_grid_id text,
  payload jsonb not null,
  coord geometry(Point, 4326),
  status text default 'pending',
  created_at timestamptz default now(),
  applied_at timestamptz,
  applied_by text
);

create index idx_geometry_edits_status on geometry_edits(status);
create index idx_geometry_edits_coord on geometry_edits using gist(coord);

-- RLS policies
alter table geometry_edits enable row level security;

create policy "Users can insert their own geometry edits"
  on geometry_edits for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own geometry edits"
  on geometry_edits for select
  using (auth.uid() = user_id);
