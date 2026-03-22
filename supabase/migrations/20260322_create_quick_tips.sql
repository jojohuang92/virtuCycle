create table if not exists public.quick_tips (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tip text not null,
  city text not null default 'General',
  state text not null default '',
  source text not null check (source in ('gemini', 'fallback')),
  created_at timestamptz not null default now()
);

create index if not exists quick_tips_user_id_created_at_idx
  on public.quick_tips (user_id, created_at desc);

alter table public.quick_tips enable row level security;

drop policy if exists "Users can view their quick tips" on public.quick_tips;
create policy "Users can view their quick tips"
  on public.quick_tips
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their quick tips" on public.quick_tips;
create policy "Users can insert their quick tips"
  on public.quick_tips
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their quick tips" on public.quick_tips;
create policy "Users can delete their quick tips"
  on public.quick_tips
  for delete
  using (auth.uid() = user_id);