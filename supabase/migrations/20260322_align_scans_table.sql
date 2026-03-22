create table if not exists public.scans (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  item text not null default '',
  bin_type text not null default 'unknown',
  confidence double precision not null default 0,
  explanation text not null default '',
  source text not null default 'fallback',
  scanned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table if exists public.scans
  add column if not exists user_id uuid references public.profiles (id) on delete cascade,
  add column if not exists item text not null default '',
  add column if not exists bin_type text not null default 'unknown',
  add column if not exists confidence double precision not null default 0,
  add column if not exists explanation text not null default '',
  add column if not exists source text not null default 'fallback',
  add column if not exists scanned_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

create index if not exists scans_user_id_scanned_at_idx
  on public.scans (user_id, scanned_at desc);

alter table public.scans enable row level security;

drop policy if exists "Users can view their scans" on public.scans;
create policy "Users can view their scans"
  on public.scans
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their scans" on public.scans;
create policy "Users can insert their scans"
  on public.scans
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their scans" on public.scans;
create policy "Users can delete their scans"
  on public.scans
  for delete
  using (auth.uid() = user_id);