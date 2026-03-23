create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10, 2) not null,
  is_popular boolean not null default false,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  address text not null,
  notes text,
  total_amount numeric(10, 2) not null,
  status text not null default 'pending',
  source text not null default 'telegram_mini_app',
  telegram_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10, 2) not null,
  quantity integer not null check (quantity > 0),
  line_total numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

insert into public.categories (id, slug, name, description, sort_order)
values
  ('11111111-1111-1111-1111-111111111111', 'osh', 'Oshlar', 'Toy oshi, choyxona oshi va kunlik palovlar.', 1),
  ('22222222-2222-2222-2222-222222222222', 'milliy-taomlar', 'Milliy taomlar', 'Manti, qovurdoq va issiq asosiy taomlar.', 2),
  ('33333333-3333-3333-3333-333333333333', 'ichimliklar', 'Ichimliklar', 'Sovuq va issiq ichimliklar, buyurtmaga mos qo''shimcha.', 3)
on conflict (id) do update
set
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.products (id, category_id, name, description, price, is_popular, sort_order)
values
  ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'Toy oshi', 'Laziz guruch, yumshoq mol go''shti va nohut bilan.', 95000, true, 1),
  ('aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '11111111-1111-1111-1111-111111111111', 'Choyxona oshi', 'An''anaviy usulda damlangan, ziravori boy osh.', 78000, true, 2),
  ('bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '22222222-2222-2222-2222-222222222222', 'Manti', 'Bug''da pishirilgan yirik manti, qaymoq bilan servis.', 62000, true, 1),
  ('bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '22222222-2222-2222-2222-222222222222', 'Qovurdoq', 'Yangi sabzavot va mol go''shti bilan qovurilgan taom.', 68000, false, 2),
  ('bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3', '22222222-2222-2222-2222-222222222222', 'Kabob to''plami', 'Assorti kabob, piyoz va non bilan.', 84000, true, 3),
  ('ccccccc1-cccc-cccc-cccc-ccccccccccc1', '33333333-3333-3333-3333-333333333333', 'Ayran', 'Sovuq va tetiklantiruvchi uy ayrani.', 12000, false, 1),
  ('ccccccc2-cccc-cccc-cccc-ccccccccccc2', '33333333-3333-3333-3333-333333333333', 'Ko''k choy', 'Issiq ko''k choy, kichik choynakda.', 9000, false, 2)
on conflict (id) do update
set
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  is_popular = excluded.is_popular,
  sort_order = excluded.sort_order;
