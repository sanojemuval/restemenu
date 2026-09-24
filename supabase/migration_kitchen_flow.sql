-- =====================================================================
-- BITECRAFT — kitchen flow update
--   * live order progress (percent) for guests
--   * chat between guest and chef
--   * one chef takes an order, every other chef sees it is taken
--   * manager / kitchen staff visibility and payment tracking
--
-- Run this ONCE in Supabase → SQL Editor → New query → Run.
-- It is safe to run again. Do NOT run the old schema.sql again.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. New order columns
-- ---------------------------------------------------------------------
alter table public.orders add column if not exists progress smallint not null default 8 check (progress between 0 and 100);
alter table public.orders add column if not exists claimed_at timestamptz;
alter table public.orders add column if not exists payment_status text not null default 'UNPAID' check (payment_status in ('UNPAID','PAID'));
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists paid_by uuid references public.profiles(id) on delete set null;

-- Give existing orders a sensible progress value.
update public.orders set progress = case status
  when 'CONFIRMED' then 20 when 'PREPARING' then 45 when 'READY' then 90
  when 'SERVED' then 100 when 'COMPLETED' then 100 else progress end
where progress = 8 and status <> 'NEW' and status <> 'CANCELLED';

-- ---------------------------------------------------------------------
-- 2. Guest <-> chef messages
-- ---------------------------------------------------------------------
create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender text not null check (sender in ('customer','staff')),
  sender_name text not null default '',
  sender_role text,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists order_messages_order_idx on public.order_messages(order_id, created_at);
alter table public.order_messages enable row level security;
-- (The read policy for this table is created in section 3b, once staff_role() exists.)
-- No insert policy on purpose: messages are only written through the functions below.

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='order_messages') then
    execute 'alter publication supabase_realtime add table public.order_messages';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. Only admins may edit orders directly. Chefs use the functions below,
--    which check that the order really belongs to them.
-- ---------------------------------------------------------------------
drop policy if exists staff_orders_update on public.orders;
drop policy if exists admin_orders_update on public.orders;
create policy admin_orders_update on public.orders for update using (public.is_admin()) with check (public.is_admin());

create or replace function public.staff_role() returns text
language sql stable security definer set search_path=public as $$
  select p.role from public.profiles p where p.id=auth.uid() and p.active=true limit 1;
$$;

-- ---------------------------------------------------------------------
-- 3b. Who may read the guest conversation
--     * While an order is open: chef, manager, kitchen staff, admin.
--     * Once it is served / completed / cancelled the chat is CLOSED for
--       the guest and the chefs. Manager, kitchen staff and admin can still
--       open the full conversation later (for example to check extra items).
-- ---------------------------------------------------------------------
create or replace function public.can_read_order_chat(p_order_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select case public.staff_role()
    when 'admin' then true
    when 'manager' then true
    when 'kitchen_staff' then true
    when 'chef' then exists(select 1 from public.orders o where o.id=p_order_id and o.status not in ('SERVED','COMPLETED','CANCELLED'))
    else false
  end;
$$;
drop policy if exists staff_messages_read on public.order_messages;
create policy staff_messages_read on public.order_messages for select using (public.can_read_order_chat(order_id));

-- ---------------------------------------------------------------------
-- 4. A chef takes an order (first chef wins, everyone else sees who has it)
-- ---------------------------------------------------------------------
create or replace function public.claim_order(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_role text := public.staff_role();
  v_order public.orders%rowtype;
  v_taken text;
begin
  if v_role is null or v_role not in ('chef','admin') then
    raise exception 'Only chefs can take an order.';
  end if;

  update public.orders
     set assigned_chef = auth.uid(), claimed_at = now(), status = 'CONFIRMED', progress = 20, updated_at = now()
   where id = p_order_id and assigned_chef is null and status = 'NEW'
  returning * into v_order;

  if not found then
    select coalesce(nullif(p.full_name,''),'another chef') into v_taken
      from public.orders o left join public.profiles p on p.id = o.assigned_chef
     where o.id = p_order_id and o.assigned_chef is not null;
    if v_taken is not null then
      raise exception 'This order was just taken by %.', v_taken;
    end if;
    raise exception 'This order is no longer available.';
  end if;

  return jsonb_build_object('id', v_order.id, 'status', v_order.status, 'progress', v_order.progress);
end;
$$;

-- Give an order back to the pool (chef who owns it, a manager or an admin)
create or replace function public.release_order(p_order_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare v_role text := public.staff_role();
begin
  if v_role is null or v_role not in ('chef','admin','manager') then
    raise exception 'You cannot release this order.';
  end if;
  update public.orders
     set assigned_chef = null, claimed_at = null, status = 'NEW', progress = 8, updated_at = now()
   where id = p_order_id
     and status in ('CONFIRMED','PREPARING')
     and (assigned_chef = auth.uid() or v_role in ('admin','manager'));
  if not found then
    raise exception 'You cannot release this order.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Move the order forward (only the chef who took it, or an admin)
-- ---------------------------------------------------------------------
create or replace function public.set_order_stage(p_order_id uuid, p_status text, p_progress int default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_role text := public.staff_role();
  v_order public.orders%rowtype;
  v_prog int;
begin
  if v_role is null or v_role not in ('chef','admin') then
    raise exception 'Only chefs can update an order.';
  end if;
  if p_status not in ('PREPARING','READY','SERVED','CANCELLED') then
    raise exception 'Invalid order status.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.status in ('SERVED','COMPLETED','CANCELLED') then
    raise exception 'This order is already finished.';
  end if;
  if v_order.assigned_chef is null and v_role <> 'admin' then
    raise exception 'Take this order first.';
  end if;
  if v_order.assigned_chef is distinct from auth.uid() and v_role <> 'admin' then
    raise exception 'This order belongs to another chef.';
  end if;

  if p_status = 'PREPARING' and v_order.status not in ('CONFIRMED','PREPARING') then raise exception 'Take this order before you start preparing it.'; end if;
  if p_status = 'READY' and v_order.status not in ('CONFIRMED','PREPARING') then raise exception 'This order cannot be marked ready yet.'; end if;
  if p_status = 'SERVED' and v_order.status <> 'READY' then raise exception 'Mark the order ready before serving it.'; end if;

  v_prog := case p_status
    when 'PREPARING' then least(greatest(coalesce(p_progress, case when v_order.status = 'PREPARING' then v_order.progress else 40 end), 30), 85)
    when 'READY' then 90
    when 'SERVED' then 100
    else v_order.progress end;

  update public.orders set status = p_status, progress = v_prog, updated_at = now() where id = p_order_id;
  return jsonb_build_object('id', p_order_id, 'status', p_status, 'progress', v_prog);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Payments (manager, kitchen staff, or admin)
-- ---------------------------------------------------------------------
create or replace function public.set_order_payment(p_order_id uuid, p_paid boolean, p_method text default null) returns void
language plpgsql security definer set search_path=public as $$
declare v_role text := public.staff_role();
begin
  if v_role is null or v_role not in ('admin','manager','kitchen_staff') then
    raise exception 'Only a manager, kitchen staff member or admin can record payments.';
  end if;
  update public.orders
     set payment_status = case when p_paid then 'PAID' else 'UNPAID' end,
         payment_method = case when p_paid then nullif(upper(btrim(coalesce(p_method,''))),'') else null end,
         paid_at = case when p_paid then now() else null end,
         paid_by = case when p_paid then auth.uid() else null end,
         updated_at = now()
   where id = p_order_id and status <> 'CANCELLED';
  if not found then raise exception 'Order not found or cancelled.'; end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Messages
-- ---------------------------------------------------------------------
create or replace function public.send_customer_message(p_tracking_token text, p_body text) returns void
language plpgsql security definer set search_path=public as $$
declare
  v_order public.orders%rowtype;
  v_body text := btrim(coalesce(p_body,''));
begin
  if char_length(v_body) < 1 then raise exception 'Type a message first.'; end if;
  if char_length(v_body) > 500 then raise exception 'Messages can be up to 500 characters.'; end if;
  select * into v_order from public.orders where tracking_token = p_tracking_token;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.status = 'CANCELLED' then raise exception 'This order was cancelled.'; end if;
  if v_order.status in ('SERVED','COMPLETED') then raise exception 'This order has been served, so messages are closed.'; end if;
  if (select count(*) from public.order_messages where order_id = v_order.id and sender = 'customer' and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'You are sending messages very quickly. Please wait a moment.';
  end if;
  insert into public.order_messages(order_id, sender, sender_name, body) values (v_order.id, 'customer', v_order.customer_name, v_body);
end;
$$;

create or replace function public.send_staff_message(p_order_id uuid, p_body text) returns void
language plpgsql security definer set search_path=public as $$
declare
  v_role text := public.staff_role();
  v_order public.orders%rowtype;
  v_body text := btrim(coalesce(p_body,''));
  v_name text;
begin
  if v_role is null or v_role not in ('chef','admin','manager') then
    raise exception 'You cannot message guests.';
  end if;
  if char_length(v_body) < 1 then raise exception 'Type a message first.'; end if;
  if char_length(v_body) > 500 then raise exception 'Messages can be up to 500 characters.'; end if;
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.status in ('SERVED','COMPLETED','CANCELLED') then raise exception 'This order is closed, so messages with the guest are closed too.'; end if;
  if v_role = 'chef' and v_order.assigned_chef is distinct from auth.uid() then
    raise exception 'Take this order to message the guest.';
  end if;
  select coalesce(nullif(full_name,''), 'Kitchen') into v_name from public.profiles where id = auth.uid();
  insert into public.order_messages(order_id, sender, sender_name, sender_role, body) values (v_order.id, 'staff', coalesce(v_name,'Kitchen'), v_role, v_body);
end;
$$;

-- ---------------------------------------------------------------------
-- 8. What the guest can see about their own order (progress, chef, chat, timeline)
-- ---------------------------------------------------------------------
create or replace function public.get_order_by_token(p_tracking_token text) returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'id',o.id,'order_number',o.order_number,'tracking_token',o.tracking_token,'customer_name',o.customer_name,
    'customer_phone',o.customer_phone,'table_id',o.table_id,'table_number',t.table_number,'status',o.status,
    'subtotal',o.subtotal,'tax',o.tax,'total',o.total,'general_note',o.general_note,'assigned_chef',o.assigned_chef,
    'created_at',o.created_at,'updated_at',o.updated_at,
    'progress',o.progress,'claimed_at',o.claimed_at,
    'payment_status',o.payment_status,'payment_method',o.payment_method,'paid_at',o.paid_at,
    'assigned_chef_name',(select nullif(p.full_name,'') from public.profiles p where p.id=o.assigned_chef),
    'restaurant_tables',case when t.id is null then null else jsonb_build_object('table_number',t.table_number) end,
    'chat_open',(o.status not in ('SERVED','COMPLETED','CANCELLED')),
    'messages',case when o.status in ('SERVED','COMPLETED','CANCELLED') then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'sender',m.sender,'sender_name',m.sender_name,'sender_role',m.sender_role,'body',m.body,'created_at',m.created_at) order by m.created_at) from public.order_messages m where m.order_id=o.id),'[]'::jsonb) end,
    'history',coalesce((select jsonb_agg(jsonb_build_object('status',h.new_status,'at',h.created_at) order by h.created_at) from public.order_status_history h where h.order_id=o.id),'[]'::jsonb),
    'order_items',coalesce((select jsonb_agg(jsonb_build_object('id',oi.id,'menu_item_id',oi.menu_item_id,'item_name_snapshot',oi.item_name_snapshot,'unit_price_snapshot',oi.unit_price_snapshot,'quantity',oi.quantity,'special_instruction',oi.special_instruction,'addons',oi.addons) order by oi.id) from public.order_items oi where oi.order_id=o.id),'[]'::jsonb)
  )
  from public.orders o left join public.restaurant_tables t on t.id=o.table_id
  where o.tracking_token=p_tracking_token
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- 9. Who may call what
-- ---------------------------------------------------------------------
revoke all on function public.claim_order(uuid) from public, anon;
revoke all on function public.release_order(uuid) from public, anon;
revoke all on function public.set_order_stage(uuid, text, int) from public, anon;
revoke all on function public.set_order_payment(uuid, boolean, text) from public, anon;
revoke all on function public.send_staff_message(uuid, text) from public, anon;
grant execute on function public.claim_order(uuid) to authenticated;
grant execute on function public.release_order(uuid) to authenticated;
grant execute on function public.set_order_stage(uuid, text, int) to authenticated;
grant execute on function public.set_order_payment(uuid, boolean, text) to authenticated;
grant execute on function public.send_staff_message(uuid, text) to authenticated;
grant execute on function public.send_customer_message(text, text) to anon, authenticated;
grant execute on function public.get_order_by_token(text) to anon, authenticated;
