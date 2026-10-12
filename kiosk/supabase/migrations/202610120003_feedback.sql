-- 주문/피드백 탭에서 익명 고객 의견을 안전하게 저장합니다.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  rating smallint not null check (rating between 1 and 5),
  tags text[] not null default '{}',
  comment text check (comment is null or char_length(comment) <= 1000),
  order_type text not null check (order_type in ('takeout', 'dine_in')),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_idx on public.feedback(created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "public submits feedback" on public.feedback;
create policy "public submits feedback" on public.feedback
for insert to anon, authenticated with check (
  rating between 1 and 5
  and cardinality(tags) <= 5
  and (comment is null or char_length(comment) <= 1000)
);

drop policy if exists "staff reads feedback" on public.feedback;
create policy "staff reads feedback" on public.feedback
for select to authenticated using (public.is_cafe_staff());

grant insert on public.feedback to anon, authenticated;
grant select on public.feedback to authenticated;
