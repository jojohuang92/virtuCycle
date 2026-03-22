create table if not exists public.recycled_items (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  item text not null,
  bin_type text not null check (bin_type in ('recycling', 'trash', 'compost', 'hazardous', 'unknown')),
  confidence double precision not null default 0,
  explanation text not null default '',
  source text not null check (source in ('mlkit', 'gemini', 'claude', 'fallback')),
  scanned_at timestamptz not null,
  recycled_at timestamptz not null default now(),
  impact_points integer not null default 0,
  impact_co2_kg numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists recycled_items_user_id_recycled_at_idx
  on public.recycled_items (user_id, recycled_at desc);

alter table public.recycled_items enable row level security;

drop policy if exists "Users can view their recycled items" on public.recycled_items;
create policy "Users can view their recycled items"
  on public.recycled_items
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their recycled items" on public.recycled_items;
create policy "Users can insert their recycled items"
  on public.recycled_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their recycled items" on public.recycled_items;
create policy "Users can delete their recycled items"
  on public.recycled_items
  for delete
  using (auth.uid() = user_id);