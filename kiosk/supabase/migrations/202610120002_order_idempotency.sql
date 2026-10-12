alter table public.orders add column if not exists request_id uuid;
update public.orders set request_id = gen_random_uuid() where request_id is null;
alter table public.orders alter column request_id set not null;
create unique index if not exists orders_request_id_idx on public.orders(request_id);
create unique index if not exists orders_order_number_idx on public.orders(order_number);

drop function if exists public.create_kiosk_order(text, text, jsonb);
drop function if exists public.create_kiosk_order(text, text, jsonb, uuid);

create function public.create_kiosk_order(
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
  if p_request_id is null then raise exception 'request id is required'; end if;
  if p_order_type not in ('takeout', 'dine_in') then raise exception 'invalid order type'; end if;
  if p_payment_method not in ('card', 'counter') then raise exception 'invalid payment method'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception 'order must contain 1 to 30 lines';
  end if;

  select id, order_number, total_amount into v_order_id, v_order_number, v_total
  from public.orders where request_id = p_request_id;
  if found then
    return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'total_amount', v_total, 'status', 'received', 'duplicate', true);
  end if;

  v_order_number := lpad(nextval('public.cafe_order_number_seq')::text, 4, '0');
  insert into public.orders (request_id, order_number, order_type, payment_method)
  values (p_request_id, v_order_number, p_order_type, p_payment_method)
  on conflict (request_id) do nothing
  returning id into v_order_id;

  if v_order_id is null then
    select id, order_number, total_amount into v_order_id, v_order_number, v_total
    from public.orders where request_id = p_request_id;
    return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'total_amount', v_total, 'status', 'received', 'duplicate', true);
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := coalesce((v_item->>'quantity')::integer, 0);
    if v_quantity < 1 or v_quantity > 20 then raise exception 'invalid quantity'; end if;

    select * into v_menu from public.menu_items
    where id = v_item->>'menu_item_id' and available = true;
    if not found then raise exception 'menu item is not available'; end if;

    if jsonb_typeof(coalesce(v_item->'option_ids', '[]'::jsonb)) <> 'array' then
      raise exception 'option_ids must be an array';
    end if;

    select count(*), coalesce(array_agg(distinct value), array[]::text[])
      into v_requested_option_count, v_option_ids
    from jsonb_array_elements_text(coalesce(v_item->'option_ids', '[]'::jsonb));

    select count(*) into v_valid_option_count from public.menu_options
    where menu_item_id = v_menu.id and active = true and id = any(v_option_ids);
    if v_requested_option_count <> v_valid_option_count then
      raise exception 'one or more options are invalid or duplicated';
    end if;

    if exists (
      select 1 from public.menu_options
      where menu_item_id = v_menu.id and active = true and id = any(v_option_ids) and group_name <> '추가'
      group by group_name having count(*) > 1
    ) then raise exception 'only one option may be selected per option group'; end if;

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
  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'total_amount', v_total, 'status', 'received', 'duplicate', false);
exception when others then
  if v_order_id is not null then delete from public.orders where id = v_order_id; end if;
  raise;
end;
$$;

revoke all on function public.create_kiosk_order(text, text, jsonb, uuid) from public;
grant execute on function public.create_kiosk_order(text, text, jsonb, uuid) to anon, authenticated;
