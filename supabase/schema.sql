-- BITECRAFT restaurant system - Supabase setup
-- Run this in the Supabase SQL editor after creating the project.
-- Then create the first auth user and promote jemuvalos@gmail.com to admin using the bootstrap SQL at the bottom.

create extension if not exists pgcrypto;

-- =========================================================
-- Core tables
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text default '',
  email text default '',
  role text not null default 'customer' check (role in ('customer','admin','manager','chef','kitchen_staff')),
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  image_url text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  table_number int not null unique,
  table_name text,
  seats int not null default 4 check (seats > 0),
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE','OCCUPIED','RESERVED','DISABLED')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null unique,
  description text not null default '',
  price numeric(12,2) not null check (price >= 0),
  image_url text,
  available boolean not null default true,
  featured boolean not null default false,
  popular boolean not null default false,
  prep_minutes int not null default 15 check (prep_minutes > 0),
  ingredients text,
  allergens text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_item_variants (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  name text not null,
  price_delta numeric(12,2) not null default 0 check (price_delta >= 0),
  active boolean not null default true
);

create table if not exists public.menu_item_addons (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  name text not null,
  price_delta numeric(12,2) not null default 0 check (price_delta >= 0),
  active boolean not null default true
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  tracking_token text unique not null default encode(gen_random_bytes(20), 'hex'),
  customer_name text not null,
  customer_phone text,
  table_id uuid references public.restaurant_tables(id) on delete set null,
  status text not null default 'NEW' check (status in ('NEW','CONFIRMED','PREPARING','READY','SERVED','CANCELLED','COMPLETED')),
  subtotal numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  general_note text,
  assigned_chef uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name_snapshot text not null,
  unit_price_snapshot numeric(12,2) not null check (unit_price_snapshot >= 0),
  quantity int not null check (quantity > 0),
  special_instruction text,
  addons jsonb not null default '[]'::jsonb
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  previous_status text,
  new_status text,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  rating int not null check (rating between 1 and 5),
  review_text text not null,
  image_url text,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  created_at timestamptz not null default now()
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  caption text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  content_key text unique not null,
  content_value jsonb not null default '{}'::jsonb,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_sections (
  id uuid primary key default gen_random_uuid(),
  section_key text unique not null,
  title text,
  settings jsonb not null default '{}'::jsonb,
  display_order int not null default 0,
  is_visible boolean not null default true,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_media (
  id uuid primary key default gen_random_uuid(),
  section_key text not null,
  media_type text not null check (media_type in ('image','video')),
  media_url text not null,
  thumbnail_url text,
  caption text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id int primary key default 1,
  restaurant_name text not null default 'e-menu',
  logo_url text,
  favicon_url text,
  phone text,
  email text,
  address text,
  opening_hours text not null default '10:00 – 22:00',
  currency text not null default 'RWF',
  tax_percentage numeric(8,2) not null default 0 check (tax_percentage >= 0),
  restaurant_status text not null default 'OPEN' check (restaurant_status in ('OPEN','CLOSED')),
  social_links jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create sequence if not exists public.order_number_seq start 1;

-- =========================================================
-- Timestamps / generated order number / auth profile
-- =========================================================
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists menu_items_updated_at on public.menu_items;
create trigger menu_items_updated_at before update on public.menu_items for each row execute function public.set_updated_at();
drop trigger if exists site_content_updated_at on public.site_content;
create trigger site_content_updated_at before update on public.site_content for each row execute function public.set_updated_at();
drop trigger if exists site_settings_updated_at on public.site_settings;
create trigger site_settings_updated_at before update on public.site_settings for each row execute function public.set_updated_at();
drop trigger if exists site_sections_updated_at on public.site_sections;
create trigger site_sections_updated_at before update on public.site_sections for each row execute function public.set_updated_at();

create or replace function public.make_order_number() returns text
language plpgsql as $$
begin
  return 'BC-' || to_char(now(),'YYYYMMDD') || '-' || lpad(nextval('public.order_number_seq')::text,3,'0');
end;
$$;

create or replace function public.set_order_number() returns trigger
language plpgsql as $$
begin
  if new.order_number is null or new.order_number = '' then new.order_number := public.make_order_number(); end if;
  return new;
end;
$$;
drop trigger if exists orders_order_number on public.orders;
create trigger orders_order_number before insert on public.orders for each row execute function public.set_order_number();


create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id, full_name, email, role)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email, 'customer')
  on conflict(id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- =========================================================
-- Security helpers
-- =========================================================
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('admin','manager','chef','kitchen_staff'));
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role='admin');
$$;

-- =========================================================
-- RLS
-- =========================================================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_item_variants enable row level security;
alter table public.menu_item_addons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.reviews enable row level security;
alter table public.gallery enable row level security;
alter table public.site_content enable row level security;
alter table public.site_sections enable row level security;
alter table public.site_media enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists public_read_categories on public.categories;
create policy public_read_categories on public.categories for select using (active=true);
drop policy if exists public_read_tables on public.restaurant_tables;
create policy public_read_tables on public.restaurant_tables for select using (active=true and status<>'DISABLED');
drop policy if exists public_read_menu on public.menu_items;
create policy public_read_menu on public.menu_items for select using (available=true);
drop policy if exists public_read_variants on public.menu_item_variants;
create policy public_read_variants on public.menu_item_variants for select using (active=true and exists(select 1 from public.menu_items m where m.id=menu_item_id and m.available=true));
drop policy if exists public_read_addons on public.menu_item_addons;
create policy public_read_addons on public.menu_item_addons for select using (active=true and exists(select 1 from public.menu_items m where m.id=menu_item_id and m.available=true));
drop policy if exists public_read_gallery on public.gallery;
create policy public_read_gallery on public.gallery for select using (active=true);
drop policy if exists public_read_reviews on public.reviews;
create policy public_read_reviews on public.reviews for select using (status='APPROVED');
drop policy if exists public_create_reviews on public.reviews;
create policy public_create_reviews on public.reviews for insert with check (status='PENDING');
drop policy if exists public_read_site_content on public.site_content;
create policy public_read_site_content on public.site_content for select using (published=true);
drop policy if exists public_read_site_sections on public.site_sections;
create policy public_read_site_sections on public.site_sections for select using (published=true);
drop policy if exists public_read_site_media on public.site_media;
create policy public_read_site_media on public.site_media for select using (active=true);
drop policy if exists public_read_settings on public.site_settings;
create policy public_read_settings on public.site_settings for select using (true);

drop policy if exists admin_profiles on public.profiles;
create policy admin_profiles on public.profiles for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists staff_profiles_read on public.profiles;
create policy staff_profiles_read on public.profiles for select using (public.is_staff());
drop policy if exists admin_categories on public.categories;
create policy admin_categories on public.categories for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_tables on public.restaurant_tables;
create policy admin_tables on public.restaurant_tables for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_menu on public.menu_items;
create policy admin_menu on public.menu_items for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_variants on public.menu_item_variants;
create policy admin_variants on public.menu_item_variants for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_addons on public.menu_item_addons;
create policy admin_addons on public.menu_item_addons for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists staff_orders_read on public.orders;
create policy staff_orders_read on public.orders for select using (public.is_staff());
drop policy if exists staff_orders_update on public.orders;
create policy staff_orders_update on public.orders for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists staff_order_items_read on public.order_items;
create policy staff_order_items_read on public.order_items for select using (public.is_staff());
drop policy if exists admin_order_history on public.order_status_history;
create policy admin_order_history on public.order_status_history for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists staff_order_history_read on public.order_status_history;
create policy staff_order_history_read on public.order_status_history for select using (public.is_staff());
drop policy if exists admin_reviews on public.reviews;
create policy admin_reviews on public.reviews for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_gallery on public.gallery;
create policy admin_gallery on public.gallery for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_site_content on public.site_content;
create policy admin_site_content on public.site_content for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_site_sections on public.site_sections;
create policy admin_site_sections on public.site_sections for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_site_media on public.site_media;
create policy admin_site_media on public.site_media for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_settings on public.site_settings;
create policy admin_settings on public.site_settings for all using (public.is_admin()) with check (public.is_admin());

-- Brand colours + logo options (name and logo_url already live on this table)
alter table public.site_settings add column if not exists brand_theme jsonb not null default '{}'::jsonb;

-- =========================================================
-- Website visual editor storage
-- =========================================================
-- Every photo / video is limited to 10 MB (10485760 bytes), enforced by Supabase Storage itself.
insert into storage.buckets (id, name, public, file_size_limit) values ('site-media', 'site-media', true, 10485760)
on conflict (id) do update set public = true, file_size_limit = 10485760;

drop policy if exists public_read_site_media_storage on storage.objects;
create policy public_read_site_media_storage on storage.objects for select using (bucket_id = 'site-media');
drop policy if exists admin_insert_site_media_storage on storage.objects;
create policy admin_insert_site_media_storage on storage.objects for insert with check (bucket_id = 'site-media' and public.is_admin());
drop policy if exists admin_update_site_media_storage on storage.objects;
create policy admin_update_site_media_storage on storage.objects for update using (bucket_id = 'site-media' and public.is_admin()) with check (bucket_id = 'site-media' and public.is_admin());
drop policy if exists admin_delete_site_media_storage on storage.objects;
create policy admin_delete_site_media_storage on storage.objects for delete using (bucket_id = 'site-media' and public.is_admin());

-- =========================================================
-- Secure order creation. The browser never inserts raw order rows.
-- Prices, taxes, variants and add-ons are re-read from the database.
-- =========================================================
create or replace function public.create_order_secure(
  p_customer_name text,
  p_customer_phone text,
  p_table_id uuid,
  p_special_request text,
  p_items jsonb
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_tracking_token text;
  v_subtotal numeric(12,2) := 0;
  v_tax numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_tax_rate numeric(8,2) := 0;
  v_item jsonb;
  v_item_count integer := 0;
  v_menu_id uuid;
  v_variant_id uuid;
  v_addon_id uuid;
  v_qty integer;
  v_base numeric(12,2);
  v_variant_delta numeric(12,2) := 0;
  v_addons_total numeric(12,2) := 0;
  v_name text;
  v_image text;
  v_variant_name text;
  v_notes text;
  v_addon_snapshot jsonb := '[]'::jsonb;
  v_table_ok boolean;
begin
  if coalesce(trim(p_customer_name),'') = '' then raise exception 'Customer name is required'; end if;
  if p_table_id is null then raise exception 'A table is required'; end if;
  if p_items is null or jsonb_array_length(p_items)=0 then raise exception 'The order has no items'; end if;
  select exists(select 1 from public.restaurant_tables where id=p_table_id and active=true and status<>'DISABLED') into v_table_ok;
  if not v_table_ok then raise exception 'Selected table is unavailable'; end if;
  select coalesce(tax_percentage,0) into v_tax_rate from public.site_settings where id=1;

  insert into public.orders(order_number,customer_name,customer_phone,table_id,status,subtotal,tax,total,general_note)
  values('',trim(p_customer_name),nullif(trim(p_customer_phone),''),p_table_id,'NEW',0,0,0,nullif(trim(p_special_request),''))
  returning id,order_number,tracking_token into v_order_id,v_order_number,v_tracking_token;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_item_count := v_item_count + 1;
    v_menu_id := nullif(v_item->>'menu_item_id','')::uuid;
    v_qty := greatest(1, least(coalesce((v_item->>'quantity')::integer,1),50));
    v_variant_id := nullif(v_item->'variant'->>'id','')::uuid;
    v_name := null;
    v_image := null;
    v_variant_name := null;
    v_notes := nullif(trim(coalesce(v_item->>'special_instruction','')),'');
    v_variant_delta := 0;
    v_addons_total := 0;
    v_addon_snapshot := '[]'::jsonb;

    select m.name,m.price,m.image_url into v_name,v_base,v_image from public.menu_items m where m.id=v_menu_id and m.available=true;
    if not found then raise exception 'One of the selected dishes is unavailable'; end if;

    if v_variant_id is not null then
      select v.name,v.price_delta into v_variant_name,v_variant_delta from public.menu_item_variants v where v.id=v_variant_id and v.menu_item_id=v_menu_id and v.active=true;
      if not found then raise exception 'One of the selected sizes is unavailable'; end if;
    end if;

    -- Validate and snapshot add-ons from the DB rather than trusting client prices.
    if jsonb_array_length(coalesce(v_item->'addons','[]'::jsonb)) > 0 then
      select coalesce(sum(a.price_delta),0), coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'price_delta',a.price_delta) order by a.name),'[]'::jsonb)
      into v_addons_total,v_addon_snapshot
      from public.menu_item_addons a
      where a.menu_item_id=v_menu_id and a.active=true and a.id in (select (x->>'id')::uuid from jsonb_array_elements(v_item->'addons') x);
      if (select count(*) from jsonb_array_elements(v_item->'addons')) <> (select count(*) from public.menu_item_addons a where a.menu_item_id=v_menu_id and a.active=true and a.id in (select (x->>'id')::uuid from jsonb_array_elements(v_item->'addons') x)) then
        raise exception 'One of the selected extras is unavailable';
      end if;
    end if;

    insert into public.order_items(order_id,menu_item_id,item_name_snapshot,unit_price_snapshot,quantity,special_instruction,addons)
    values(v_order_id,v_menu_id,concat(v_name,case when v_variant_name is not null then ' · '||v_variant_name else '' end),v_base+v_variant_delta+v_addons_total,v_qty,v_notes,v_addon_snapshot);
    v_subtotal := v_subtotal + (v_base+v_variant_delta+v_addons_total) * v_qty;
  end loop;

  if v_item_count=0 then raise exception 'The order has no valid items'; end if;
  v_tax := round(v_subtotal * v_tax_rate / 100.0,2);
  v_total := v_subtotal + v_tax;
  update public.orders set subtotal=v_subtotal,tax=v_tax,total=v_total,updated_at=now() where id=v_order_id;
  return jsonb_build_object('id',v_order_id,'order_number',v_order_number,'tracking_token',v_tracking_token,'demo',false);
exception when others then
  if v_order_id is not null then delete from public.orders where id=v_order_id; end if;
  raise;
end;
$$;


create or replace function public.get_order_by_token(p_tracking_token text) returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'id',o.id,'order_number',o.order_number,'tracking_token',o.tracking_token,'customer_name',o.customer_name,
    'customer_phone',o.customer_phone,'table_id',o.table_id,'table_number',t.table_number,'status',o.status,
    'subtotal',o.subtotal,'tax',o.tax,'total',o.total,'general_note',o.general_note,'assigned_chef',o.assigned_chef,
    'created_at',o.created_at,'updated_at',o.updated_at,
    'restaurant_tables',case when t.id is null then null else jsonb_build_object('table_number',t.table_number) end,
    'order_items',coalesce((select jsonb_agg(jsonb_build_object('id',oi.id,'menu_item_id',oi.menu_item_id,'item_name_snapshot',oi.item_name_snapshot,'unit_price_snapshot',oi.unit_price_snapshot,'quantity',oi.quantity,'special_instruction',oi.special_instruction,'addons',oi.addons) order by oi.id) from public.order_items oi where oi.order_id=o.id),'[]'::jsonb)
  )
  from public.orders o left join public.restaurant_tables t on t.id=o.table_id
  where o.tracking_token=p_tracking_token
  limit 1;
$$;

grant execute on function public.create_order_secure(text,text,uuid,text,jsonb) to anon, authenticated;
grant execute on function public.get_order_by_token(text) to anon, authenticated;

-- Record every status transition for the admin audit trail.
create or replace function public.record_order_status() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.order_status_history(order_id,changed_by,previous_status,new_status) values(new.id,auth.uid(),null,new.status);
  elsif old.status is distinct from new.status then
    insert into public.order_status_history(order_id,changed_by,previous_status,new_status) values(new.id,auth.uid(),old.status,new.status);
  end if;
  return new;
end;
$$;
drop trigger if exists order_status_audit on public.orders;
create trigger order_status_audit after insert or update of status on public.orders for each row execute function public.record_order_status();

-- Make realtime available for kitchen/customer status refreshes.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='orders') then
    execute 'alter publication supabase_realtime add table public.orders';
  end if;
end $$;

-- =========================================================
-- Initial content
-- =========================================================
insert into public.site_settings(id,restaurant_name,phone,email,address,opening_hours,currency,tax_percentage,restaurant_status,social_links)
values(1,'e-menu','+250 788 000 000','hello@bitecraft.rw','KG 7 Ave, Kigali, Rwanda','10:00 – 22:00','RWF',0,'OPEN','{"instagram":"#","facebook":"#","whatsapp":"#"}'::jsonb)
on conflict(id) do nothing;

insert into public.categories(name,sort_order,image_url) values
('Burgers',1,'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1000&q=84'),
('Pizza',2,'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=1000&q=84'),
('Chicken',3,'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=1000&q=84'),
('Pasta',4,'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1000&q=84'),
('Drinks',5,'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=1000&q=84'),
('Desserts',6,'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1000&q=84')
on conflict(name) do nothing;

insert into public.restaurant_tables(table_number,seats,status,active)
select g,case when g<=4 then 2 else 4 end,'AVAILABLE',true from generate_series(1,12) g
on conflict(table_number) do nothing;

insert into public.menu_items(category_id,name,description,price,image_url,available,featured,popular,prep_minutes,ingredients,allergens) values
((select id from public.categories where name='Burgers'),'Bitecraft Classic','Char-grilled beef, cheddar, tomato, lettuce and house sauce.',8500,'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1000&q=84',true,true,true,15,'Beef, cheddar, tomato, lettuce, house sauce','Dairy, gluten'),
((select id from public.categories where name='Pizza'),'Smoky Chicken Pizza','Roast chicken, smoked cheese, peppers and basil on our crisp crust.',12000,'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=1000&q=84',true,true,true,22,'Chicken, smoked cheese, peppers, basil','Dairy, gluten'),
((select id from public.categories where name='Chicken'),'Crispy Chicken Basket','Golden chicken, fries, slaw and a bright herb dip.',10500,'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=1000&q=84',true,true,false,18,'Chicken, potatoes, cabbage, herb dip','Gluten'),
((select id from public.categories where name='Pasta'),'Creamy Alfredo','Silky parmesan cream, garlic, herbs and toasted crumbs.',9750,'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1000&q=84',true,false,false,16,'Pasta, cream, parmesan, garlic','Dairy, gluten'),
((select id from public.categories where name='Chicken'),'Spicy Fire Wings','Crispy wings glazed with our smoky house chilli sauce.',9250,'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=1000&q=84',true,false,true,17,'Chicken wings, chilli sauce','Gluten'),
((select id from public.categories where name='Drinks'),'Sunset Lemonade','Fresh lemon, citrus peel, mint and sparkling water.',4000,'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=1000&q=84',true,false,false,3,'Lemon, mint, sparkling water','None'),
((select id from public.categories where name='Desserts'),'Chocolate Lava Cake','Warm chocolate cake, molten center and vanilla ice cream.',6500,'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1000&q=84',true,false,true,10,'Chocolate, flour, egg, vanilla ice cream','Dairy, gluten, egg')
on conflict(name) do nothing;

insert into public.menu_item_variants(menu_item_id,name,price_delta)
select m.id,'Regular',0 from public.menu_items m where m.name='Bitecraft Classic' and not exists(select 1 from public.menu_item_variants v where v.menu_item_id=m.id and v.name='Regular');
insert into public.menu_item_variants(menu_item_id,name,price_delta)
select m.id,'Double',2500 from public.menu_items m where m.name='Bitecraft Classic' and not exists(select 1 from public.menu_item_variants v where v.menu_item_id=m.id and v.name='Double');
insert into public.menu_item_variants(menu_item_id,name,price_delta)
select m.id,'Medium',0 from public.menu_items m where m.name='Smoky Chicken Pizza' and not exists(select 1 from public.menu_item_variants v where v.menu_item_id=m.id and v.name='Medium');
insert into public.menu_item_variants(menu_item_id,name,price_delta)
select m.id,'Large',3500 from public.menu_items m where m.name='Smoky Chicken Pizza' and not exists(select 1 from public.menu_item_variants v where v.menu_item_id=m.id and v.name='Large');

insert into public.menu_item_addons(menu_item_id,name,price_delta)
select m.id,'Extra cheese',800 from public.menu_items m where m.name='Bitecraft Classic' and not exists(select 1 from public.menu_item_addons a where a.menu_item_id=m.id and a.name='Extra cheese');
insert into public.menu_item_addons(menu_item_id,name,price_delta)
select m.id,'Bacon',1200 from public.menu_items m where m.name='Bitecraft Classic' and not exists(select 1 from public.menu_item_addons a where a.menu_item_id=m.id and a.name='Bacon');
insert into public.menu_item_addons(menu_item_id,name,price_delta)
select m.id,'Extra sauce',300 from public.menu_items m where m.name='Bitecraft Classic' and not exists(select 1 from public.menu_item_addons a where a.menu_item_id=m.id and a.name='Extra sauce');
insert into public.menu_item_addons(menu_item_id,name,price_delta)
select m.id,'Extra cheese',1000 from public.menu_items m where m.name='Smoky Chicken Pizza' and not exists(select 1 from public.menu_item_addons a where a.menu_item_id=m.id and a.name='Extra cheese');
insert into public.menu_item_addons(menu_item_id,name,price_delta)
select m.id,'Chilli flakes',200 from public.menu_items m where m.name='Smoky Chicken Pizza' and not exists(select 1 from public.menu_item_addons a where a.menu_item_id=m.id and a.name='Chilli flakes');
insert into public.menu_item_addons(menu_item_id,name,price_delta)
select m.id,'Extra dip',400 from public.menu_items m where m.name='Crispy Chicken Basket' and not exists(select 1 from public.menu_item_addons a where a.menu_item_id=m.id and a.name='Extra dip');
insert into public.menu_item_addons(menu_item_id,name,price_delta)
select m.id,'Extra fries',1200 from public.menu_items m where m.name='Crispy Chicken Basket' and not exists(select 1 from public.menu_item_addons a where a.menu_item_id=m.id and a.name='Extra fries');
insert into public.menu_item_addons(menu_item_id,name,price_delta)
select m.id,'Grilled chicken',1800 from public.menu_items m where m.name='Creamy Alfredo' and not exists(select 1 from public.menu_item_addons a where a.menu_item_id=m.id and a.name='Grilled chicken');
insert into public.menu_item_addons(menu_item_id,name,price_delta)
select m.id,'Extra parmesan',600 from public.menu_items m where m.name='Creamy Alfredo' and not exists(select 1 from public.menu_item_addons a where a.menu_item_id=m.id and a.name='Extra parmesan');
insert into public.menu_item_addons(menu_item_id,name,price_delta)
select m.id,'Extra hot',0 from public.menu_items m where m.name='Spicy Fire Wings' and not exists(select 1 from public.menu_item_addons a where a.menu_item_id=m.id and a.name='Extra hot');
insert into public.menu_item_addons(menu_item_id,name,price_delta)
select m.id,'Ginger shot',500 from public.menu_items m where m.name='Sunset Lemonade' and not exists(select 1 from public.menu_item_addons a where a.menu_item_id=m.id and a.name='Ginger shot');

insert into public.reviews(customer_name,rating,review_text,status) values
('Sarah M.',5,'The burgers were hot, fresh and full of flavor. Ordering by table was so simple.','APPROVED'),
('Daniel K.',5,'Great atmosphere and the kitchen screen kept everything moving quickly.','APPROVED'),
('Aline N.',4,'The spicy wings are a must. We will definitely come back.','APPROVED')
;

insert into public.gallery(image_url,caption,sort_order,active) values
('https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1000&q=84','Bitecraft Classic',1,true),
('https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=1000&q=84','Smoky Chicken Pizza',2,true),
('https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=1000&q=84','Crispy Chicken Basket',3,true),
('https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1000&q=84','Creamy Alfredo',4,true)
;

insert into public.site_content(content_key,content_value) values
('home.hero','{"title":"FLAVOR THAT FEELS LIKE HOME.","subtitle":"Bold comfort food, made to order and served straight to your table.","image_url":"https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1800&q=86","primary_button":"VIEW MENU","secondary_button":"OUR STORY"}'::jsonb),
('home.featured_items','{"eyebrow":"CHEF''S SPECIAL PICKS","title":"Our meal menu"}'::jsonb),
('home.categories','{"eyebrow":"WHAT ARE YOU CRAVING?","title":"Pick your favorite"}'::jsonb),
('home.reviews','{"eyebrow":"OUR HAPPY CUSTOMERS","title":"Words from the table"}'::jsonb),
('home.gallery','{"title":"A little look inside"}'::jsonb),
('home.warm','{"label":"ARE YOU HUNGRY?","title":"WE\u0027RE READY.","text":"Choose your table, build your meal, and send the order straight to our kitchen."}'::jsonb),
('home.why','{"title":"Big flavor. Honest ingredients. Fast service.","text":"Every dish starts with fresh ingredients and ends with a table worth lingering around.","items":["Fresh daily ingredients","Made-to-order kitchen","Friendly table service"]}'::jsonb),
('home.about','{"title":"A neighborhood table with a kitchen that cares.","text":"A warm restaurant experience built around comfort food, quick service and good company."}'::jsonb),
('home.cta','{"title":"Make your table the best seat in the house.","text":"Order directly from the menu and skip the wait."}'::jsonb),
('footer','{"tagline":"Good food, warm tables, memorable moments."}'::jsonb)
on conflict(content_key) do nothing;

insert into public.site_sections(section_key,title,display_order,is_visible,published) values
('hero','Hero',1,true,true),('warm','Hungry band',2,true,true),('featured_items','Chef specials',3,true,true),('categories','Categories',4,true,true),('why_choose_us','Why choose us',5,true,true),('about','About',6,true,true),('reviews','Reviews',7,true,true),('gallery','Gallery',8,true,true),('cta','Call to action',9,true,true),('footer','Footer',10,true,true)
on conflict(section_key) do nothing;

-- =========================================================
-- First administrator bootstrap
-- =========================================================
-- 1) Supabase Dashboard > Authentication > Users > Add user.
-- 2) Create the user with email jemuvalos@gmail.com and the password you choose.
-- 3) Run this once after that user exists:
--    update public.profiles set role='admin', active=true where lower(email)=lower('jemuvalos@gmail.com');
