-- 모닝브루 카페 키오스크
-- GitHub Pages 정적 클라이언트가 Publishable Key로 접근하고,
-- 가격 계산과 주문 생성은 이 파일의 보안 함수가 서버에서 다시 검증합니다.

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id text primary key,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id text primary key,
  category_id text not null references public.categories(id),
  name text not null,
  description text not null default '',
  price integer not null check (price >= 0),
  badge text not null default '',
  available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_options (
  id text primary key,
  menu_item_id text not null references public.menu_items(id) on delete cascade,
  group_name text not null,
  name text not null,
  price_delta integer not null default 0 check (price_delta >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  unique (menu_item_id, group_name, name)
);

create table if not exists public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '운영자',
  role text not null default 'staff' check (role in ('staff', 'manager')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create sequence if not exists public.cafe_order_number_seq start 101;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  order_number text not null unique,
  order_type text not null check (order_type in ('takeout', 'dine_in')),
  payment_method text not null check (payment_method in ('card', 'counter')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  status text not null default 'received' check (status in ('received', 'preparing', 'ready', 'completed', 'cancelled')),
  total_amount integer not null default 0 check (total_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id text not null references public.menu_items(id),
  item_name text not null,
  base_price integer not null check (base_price >= 0),
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 20),
  option_summary text not null default ''
);

create index if not exists menu_items_category_sort_idx on public.menu_items(category_id, sort_order);
create index if not exists orders_status_created_idx on public.orders(status, created_at);
create index if not exists order_items_order_idx on public.order_items(order_id);

create or replace function public.is_cafe_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_profiles
    where user_id = auth.uid() and active = true
  );
$$;

revoke all on function public.is_cafe_staff() from public;
grant execute on function public.is_cafe_staff() to anon, authenticated;

alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_options enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "public reads active categories" on public.categories;
create policy "public reads active categories" on public.categories
for select to anon, authenticated using (active = true or public.is_cafe_staff());

drop policy if exists "public reads available menu" on public.menu_items;
create policy "public reads available menu" on public.menu_items
for select to anon, authenticated using (available = true or public.is_cafe_staff());

drop policy if exists "public reads active options" on public.menu_options;
create policy "public reads active options" on public.menu_options
for select to anon, authenticated using (active = true or public.is_cafe_staff());

drop policy if exists "staff manages categories" on public.categories;
create policy "staff manages categories" on public.categories
for all to authenticated using (public.is_cafe_staff()) with check (public.is_cafe_staff());

drop policy if exists "staff manages menu" on public.menu_items;
create policy "staff manages menu" on public.menu_items
for all to authenticated using (public.is_cafe_staff()) with check (public.is_cafe_staff());

drop policy if exists "staff manages options" on public.menu_options;
create policy "staff manages options" on public.menu_options
for all to authenticated using (public.is_cafe_staff()) with check (public.is_cafe_staff());

drop policy if exists "staff reads own profile" on public.staff_profiles;
create policy "staff reads own profile" on public.staff_profiles
for select to authenticated using (user_id = auth.uid());

drop policy if exists "staff reads orders" on public.orders;
create policy "staff reads orders" on public.orders
for select to authenticated using (public.is_cafe_staff());

drop policy if exists "staff updates orders" on public.orders;
create policy "staff updates orders" on public.orders
for update to authenticated using (public.is_cafe_staff()) with check (public.is_cafe_staff());

drop policy if exists "staff reads order items" on public.order_items;
create policy "staff reads order items" on public.order_items
for select to authenticated using (public.is_cafe_staff());

grant select on public.categories, public.menu_items, public.menu_options to anon, authenticated;
grant select on public.orders to authenticated;
revoke update on public.orders from authenticated;
grant select on public.order_items, public.staff_profiles to authenticated;
grant insert, update, delete on public.categories, public.menu_items, public.menu_options to authenticated;

drop function if exists public.create_kiosk_order(text, text, jsonb);

create or replace function public.create_kiosk_order(
  p_order_type text,
  p_payment_method text,
  p_items jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_total integer := 0;
  v_item jsonb;
  v_menu public.menu_items%rowtype;
  v_quantity integer;
  v_option_ids text[];
  v_requested_option_count integer;
  v_valid_option_count integer;
  v_option_total integer;
  v_option_summary text;
  v_unit_price integer;
begin
  if p_request_id is null then
    raise exception 'request id is required';
  end if;
  if p_order_type not in ('takeout', 'dine_in') then
    raise exception 'invalid order type';
  end if;
  if p_payment_method not in ('card', 'counter') then
    raise exception 'invalid payment method';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception 'order must contain 1 to 30 lines';
  end if;

  select id, order_number, total_amount
    into v_order_id, v_order_number, v_total
  from public.orders
  where request_id = p_request_id;

  if found then
    return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'total_amount', v_total, 'status', 'received', 'duplicate', true);
  end if;

  v_order_number := lpad(nextval('public.cafe_order_number_seq')::text, 4, '0');
  insert into public.orders (request_id, order_number, order_type, payment_method)
  values (p_request_id, v_order_number, p_order_type, p_payment_method)
  on conflict (request_id) do nothing
  returning id into v_order_id;

  if v_order_id is null then
    select id, order_number, total_amount
      into v_order_id, v_order_number, v_total
    from public.orders
    where request_id = p_request_id;
    return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'total_amount', v_total, 'status', 'received', 'duplicate', true);
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := coalesce((v_item->>'quantity')::integer, 0);
    if v_quantity < 1 or v_quantity > 20 then
      raise exception 'invalid quantity';
    end if;

    select * into v_menu
    from public.menu_items
    where id = v_item->>'menu_item_id' and available = true;
    if not found then
      raise exception 'menu item is not available';
    end if;

    if jsonb_typeof(coalesce(v_item->'option_ids', '[]'::jsonb)) <> 'array' then
      raise exception 'option_ids must be an array';
    end if;

    select count(*), coalesce(array_agg(distinct value), array[]::text[])
      into v_requested_option_count, v_option_ids
    from jsonb_array_elements_text(coalesce(v_item->'option_ids', '[]'::jsonb));

    select count(*)
      into v_valid_option_count
    from public.menu_options
    where menu_item_id = v_menu.id and active = true and id = any(v_option_ids);

    if v_requested_option_count <> v_valid_option_count then
      raise exception 'one or more options are invalid or duplicated';
    end if;

    if exists (
      select 1
      from public.menu_options
      where menu_item_id = v_menu.id and active = true and id = any(v_option_ids)
        and group_name <> '추가'
      group by group_name
      having count(*) > 1
    ) then
      raise exception 'only one option may be selected per option group';
    end if;

    select coalesce(sum(price_delta), 0), coalesce(string_agg(name, ', ' order by sort_order, name), '')
      into v_option_total, v_option_summary
    from public.menu_options
    where menu_item_id = v_menu.id and active = true and id = any(v_option_ids);

    v_unit_price := v_menu.price + v_option_total;
    insert into public.order_items
      (order_id, menu_item_id, item_name, base_price, unit_price, quantity, option_summary)
    values
      (v_order_id, v_menu.id, v_menu.name, v_menu.price, v_unit_price, v_quantity, v_option_summary);
    v_total := v_total + (v_unit_price * v_quantity);
  end loop;

  update public.orders set total_amount = v_total, updated_at = now() where id = v_order_id;
  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'total_amount', v_total, 'status', 'received');
exception when others then
  if v_order_id is not null then delete from public.orders where id = v_order_id; end if;
  raise;
end;
$$;

revoke all on function public.create_kiosk_order(text, text, jsonb, uuid) from public;
grant execute on function public.create_kiosk_order(text, text, jsonb, uuid) to anon, authenticated;

create or replace function public.advance_kiosk_order(
  p_order_id uuid,
  p_next_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_cafe_staff() then
    raise exception 'staff access required';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order not found';
  end if;

  if not (
    (v_order.status = 'received' and p_next_status in ('preparing', 'cancelled')) or
    (v_order.status = 'preparing' and p_next_status in ('ready', 'cancelled')) or
    (v_order.status = 'ready' and p_next_status in ('completed', 'cancelled'))
  ) then
    raise exception 'invalid order status transition';
  end if;

  update public.orders
  set status = p_next_status, updated_at = now()
  where id = p_order_id
  returning * into v_order;

  return jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'updated_at', v_order.updated_at
  );
end;
$$;

revoke all on function public.advance_kiosk_order(uuid, text) from public;
grant execute on function public.advance_kiosk_order(uuid, text) to authenticated;

insert into public.categories (id, name, sort_order) values
  ('coffee', '커피', 1), ('noncoffee', '논커피', 2), ('tea', '티', 3), ('dessert', '디저트', 4)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into public.menu_items (id, category_id, name, description, price, badge, sort_order) values
  ('americano', 'coffee', '아메리카노', '고소한 초콜릿 향과 깔끔한 끝맛', 3500, 'BEST', 1),
  ('cafe-latte', 'coffee', '카페 라테', '에스프레소와 부드러운 우유의 균형', 4300, '추천', 2),
  ('vanilla-latte', 'coffee', '바닐라 라테', '은은한 바닐라와 진한 에스프레소', 4800, '', 3),
  ('flat-white', 'coffee', '플랫 화이트', '묵직한 리스트레토와 고운 우유 거품', 4700, 'NEW', 4),
  ('matcha-latte', 'noncoffee', '말차 라테', '진한 제주 말차와 담백한 우유', 5200, '추천', 1),
  ('chocolate', 'noncoffee', '리얼 초콜릿', '달콤쌉싸름한 다크 초콜릿 음료', 5000, '', 2),
  ('lemon-ade', 'noncoffee', '레몬 에이드', '상큼한 레몬과 청량한 탄산', 4900, 'ICE', 3),
  ('earl-grey', 'tea', '얼그레이 티', '베르가못 향이 산뜻한 홍차', 4000, '', 1),
  ('citron-tea', 'tea', '유자차', '달콤한 유자 과육을 담은 따뜻한 차', 4300, '', 2),
  ('croissant', 'dessert', '버터 크루아상', '겹겹이 바삭하고 고소한 페이스트리', 3800, 'BEST', 1),
  ('financier', 'dessert', '솔티드 휘낭시에', '갈색 버터 향과 소금의 은은한 조화', 3200, '', 2),
  ('cheesecake', 'dessert', '바스크 치즈케이크', '짙고 크리미한 치즈 풍미', 5900, '추천', 3)
on conflict (id) do update set
  category_id = excluded.category_id, name = excluded.name, description = excluded.description,
  price = excluded.price, badge = excluded.badge, sort_order = excluded.sort_order, updated_at = now();

-- 음료 기본 옵션
insert into public.menu_options (id, menu_item_id, group_name, name, price_delta, sort_order)
select id || '-temp-hot', id, '온도', 'HOT', 0, 1 from public.menu_items where category_id in ('coffee','noncoffee','tea')
on conflict (id) do nothing;
insert into public.menu_options (id, menu_item_id, group_name, name, price_delta, sort_order)
select id || '-temp-ice', id, '온도', 'ICE', 0, 2 from public.menu_items where category_id in ('coffee','noncoffee','tea')
on conflict (id) do nothing;
insert into public.menu_options (id, menu_item_id, group_name, name, price_delta, sort_order)
select id || '-size-regular', id, '크기', 'Regular', 0, 1 from public.menu_items where category_id in ('coffee','noncoffee','tea')
on conflict (id) do nothing;
insert into public.menu_options (id, menu_item_id, group_name, name, price_delta, sort_order)
select id || '-size-large', id, '크기', 'Large', 700, 2 from public.menu_items where category_id in ('coffee','noncoffee','tea')
on conflict (id) do nothing;

-- 커피와 라테 추가 옵션
insert into public.menu_options (id, menu_item_id, group_name, name, price_delta, sort_order)
select id || '-extra-shot', id, '추가', '샷 추가', 500, 1 from public.menu_items where category_id = 'coffee'
on conflict (id) do nothing;
insert into public.menu_options (id, menu_item_id, group_name, name, price_delta, sort_order)
select id || '-extra-decaf', id, '추가', '디카페인', 500, 2 from public.menu_items where category_id = 'coffee'
on conflict (id) do nothing;
insert into public.menu_options (id, menu_item_id, group_name, name, price_delta, sort_order)
select id || '-extra-oat', id, '추가', '오트 밀크', 700, 3 from public.menu_items where name like '%라테%' or id = 'flat-white'
on conflict (id) do nothing;

-- 디저트 데우기 옵션
insert into public.menu_options (id, menu_item_id, group_name, name, price_delta, sort_order)
select id || '-warm', id, '데우기', '따뜻하게', 0, 1 from public.menu_items where category_id = 'dessert'
on conflict (id) do nothing;
insert into public.menu_options (id, menu_item_id, group_name, name, price_delta, sort_order)
select id || '-plain', id, '데우기', '그대로', 0, 2 from public.menu_items where category_id = 'dessert'
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'menu_items') then
    alter publication supabase_realtime add table public.menu_items;
  end if;
end $$;

-- 운영자 등록 방법
-- 1) Supabase Authentication > Users에서 이메일/비밀번호 사용자를 생성합니다.
-- 2) 아래 이메일을 실제 운영자 이메일로 바꿔 한 번 실행합니다.
-- insert into public.staff_profiles (user_id, display_name, role)
-- select id, '카페 운영자', 'manager' from auth.users where email = 'staff@example.com';
