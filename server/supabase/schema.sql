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
  customer_lat double precision,
  customer_lng double precision,
  delivery_distance_km double precision not null default 0,
  delivery_fee integer not null default 0,
  total_amount numeric(10, 2) not null,
  status text not null default 'pending',
  source text not null default 'telegram_mini_app',
  telegram_payload jsonb,
  created_at timestamptz not null default now()
);

alter table if exists public.orders add column if not exists customer_lat double precision;
alter table if exists public.orders add column if not exists customer_lng double precision;
alter table if exists public.orders add column if not exists delivery_distance_km double precision not null default 0;
alter table if exists public.orders add column if not exists delivery_fee integer not null default 0;

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

delete from public.products
where id not in ('11111111-1111-1111-1111-000000000001', '11111111-1111-1111-1111-000000000002', '11111111-1111-1111-1111-000000000003', '11111111-1111-1111-1111-000000000004', '11111111-1111-1111-1111-000000000005', '11111111-1111-1111-1111-000000000006', '11111111-1111-1111-1111-000000000007', '11111111-1111-1111-1111-000000000008', '11111111-1111-1111-1111-000000000009', '11111111-1111-1111-1111-000000000010', '22222222-2222-2222-2222-000000000001', '22222222-2222-2222-2222-000000000002', '22222222-2222-2222-2222-000000000003', '22222222-2222-2222-2222-000000000004', '22222222-2222-2222-2222-000000000005', '22222222-2222-2222-2222-000000000006', '22222222-2222-2222-2222-000000000007', '22222222-2222-2222-2222-000000000008', '22222222-2222-2222-2222-000000000009', '22222222-2222-2222-2222-000000000010', '33333333-3333-3333-3333-000000000001', '33333333-3333-3333-3333-000000000002', '33333333-3333-3333-3333-000000000003', '33333333-3333-3333-3333-000000000004', '33333333-3333-3333-3333-000000000005', '33333333-3333-3333-3333-000000000006', '33333333-3333-3333-3333-000000000007', '33333333-3333-3333-3333-000000000008', '33333333-3333-3333-3333-000000000009', '33333333-3333-3333-3333-000000000010', '33333333-3333-3333-3333-000000000011', '33333333-3333-3333-3333-000000000012', '33333333-3333-3333-3333-000000000013', '33333333-3333-3333-3333-000000000014', '33333333-3333-3333-3333-000000000015', '33333333-3333-3333-3333-000000000016', '44444444-4444-4444-4444-000000000001', '44444444-4444-4444-4444-000000000002', '44444444-4444-4444-4444-000000000003', '44444444-4444-4444-4444-000000000004', '44444444-4444-4444-4444-000000000005', '55555555-5555-5555-5555-000000000001', '55555555-5555-5555-5555-000000000002', '55555555-5555-5555-5555-000000000003', '55555555-5555-5555-5555-000000000004', '55555555-5555-5555-5555-000000000005', '55555555-5555-5555-5555-000000000006', '55555555-5555-5555-5555-000000000007', '55555555-5555-5555-5555-000000000008', '66666666-6666-6666-6666-000000000001', '66666666-6666-6666-6666-000000000002', '66666666-6666-6666-6666-000000000003', '66666666-6666-6666-6666-000000000004', '66666666-6666-6666-6666-000000000005', '66666666-6666-6666-6666-000000000006', '66666666-6666-6666-6666-000000000007', '66666666-6666-6666-6666-000000000008', '66666666-6666-6666-6666-000000000009', '66666666-6666-6666-6666-000000000010', '66666666-6666-6666-6666-000000000011', '66666666-6666-6666-6666-000000000012', '66666666-6666-6666-6666-000000000013', '66666666-6666-6666-6666-000000000014', '66666666-6666-6666-6666-000000000015', '66666666-6666-6666-6666-000000000016', '66666666-6666-6666-6666-000000000017', '77777777-7777-7777-7777-000000000001', '77777777-7777-7777-7777-000000000002', '77777777-7777-7777-7777-000000000003', '88888888-8888-8888-8888-000000000001', '88888888-8888-8888-8888-000000000002', '88888888-8888-8888-8888-000000000003', '88888888-8888-8888-8888-000000000004', '88888888-8888-8888-8888-000000000005', '88888888-8888-8888-8888-000000000006', '88888888-8888-8888-8888-000000000007', '88888888-8888-8888-8888-000000000008', '88888888-8888-8888-8888-000000000009', '88888888-8888-8888-8888-000000000010', '88888888-8888-8888-8888-000000000011', '88888888-8888-8888-8888-000000000012');

delete from public.categories
where id not in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666', '77777777-7777-7777-7777-777777777777', '88888888-8888-8888-8888-888888888888');

insert into public.categories (id, slug, name, description, sort_order)
values
  ('11111111-1111-1111-1111-111111111111', 'osh-va-uygur-taomlari', 'Osh va uyg''ur taomlari', 'To''y oshi, lag''mon va uyg''urcha issiq taomlar.', 1),
  ('22222222-2222-2222-2222-222222222222', 'fast-food', 'Fast food', 'Lavash, club sandvich va tez tayyor bo''ladigan taomlar.', 2),
  ('33333333-3333-3333-3333-333333333333', 'yengil-taomlar', 'Yengil taomlar', 'Yengil tamaddilar, ramen, salatlar va qo''shimchalar.', 3),
  ('44444444-4444-4444-4444-444444444444', 'pitsalar', 'Pitsalar', 'Mazali pitsalar va assorti tanlovlar.', 4),
  ('55555555-5555-5555-5555-555555555555', 'shirinliklar', 'Shirinliklar', 'Vafli va shirin desertlar.', 5),
  ('66666666-6666-6666-6666-666666666666', 'ichimliklar', 'Ichimliklar', 'Sovuq ichimliklar va energetiklar.', 6),
  ('77777777-7777-7777-7777-777777777777', 'kofe', 'Kofe', 'Issiq kofe ichimliklari.', 7),
  ('88888888-8888-8888-8888-888888888888', 'choy-va-kokteyllar', 'Choy va kokteyllar', 'Choylar, kokteyllar va salqin ichimliklar.', 8)
on conflict (id) do update
set
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.products (id, category_id, name, description, price, is_popular, is_available, sort_order)
values
  ('11111111-1111-1111-1111-000000000001', '11111111-1111-1111-1111-111111111111', 'To''y oshi', 'To''y oshi - oshxonaning to''yimli issiq taomlaridan biri.', 34000, true, true, 1),
  ('11111111-1111-1111-1111-000000000002', '11111111-1111-1111-1111-111111111111', 'Uyg''ur lag''mon 0.7', 'Uyg''ur lag''mon 0.7 - oshxonaning to''yimli issiq taomlaridan biri.', 36000, false, true, 2),
  ('11111111-1111-1111-1111-000000000003', '11111111-1111-1111-1111-111111111111', 'Uyg''ur lag''mon 1.0', 'Uyg''ur lag''mon 1.0 - oshxonaning to''yimli issiq taomlaridan biri.', 39000, true, true, 3),
  ('11111111-1111-1111-1111-000000000004', '11111111-1111-1111-1111-111111111111', 'Qovurma lag''mon 0.7', 'Qovurma lag''mon 0.7 - oshxonaning to''yimli issiq taomlaridan biri.', 36000, false, true, 4),
  ('11111111-1111-1111-1111-000000000005', '11111111-1111-1111-1111-111111111111', 'Qovurma lag''mon 1.0', 'Qovurma lag''mon 1.0 - oshxonaning to''yimli issiq taomlaridan biri.', 39000, false, true, 5),
  ('11111111-1111-1111-1111-000000000006', '11111111-1111-1111-1111-111111111111', 'Broklin', 'Broklin - oshxonaning to''yimli issiq taomlaridan biri.', 65000, false, true, 6),
  ('11111111-1111-1111-1111-000000000007', '11111111-1111-1111-1111-111111111111', 'Achchiq go''sht', 'Achchiq go''sht - oshxonaning to''yimli issiq taomlaridan biri.', 65000, true, true, 7),
  ('11111111-1111-1111-1111-000000000008', '11111111-1111-1111-1111-111111111111', 'Sokoro', 'Sokoro - oshxonaning to''yimli issiq taomlaridan biri.', 55000, false, true, 8),
  ('11111111-1111-1111-1111-000000000009', '11111111-1111-1111-1111-111111111111', 'Uyg''urcha go''sht', 'Uyg''urcha go''sht - oshxonaning to''yimli issiq taomlaridan biri.', 49000, false, true, 9),
  ('11111111-1111-1111-1111-000000000010', '11111111-1111-1111-1111-111111111111', 'Go''sht say', 'Go''sht say - oshxonaning to''yimli issiq taomlaridan biri.', 60000, false, true, 10),
  ('22222222-2222-2222-2222-000000000001', '22222222-2222-2222-2222-222222222222', 'Lavash', 'Lavash - tez tayyorlanadigan mazali fast food tanlovi.', 29000, true, true, 1),
  ('22222222-2222-2222-2222-000000000002', '22222222-2222-2222-2222-222222222222', 'Pishloqli lavash', 'Pishloqli lavash - tez tayyorlanadigan mazali fast food tanlovi.', 32000, false, true, 2),
  ('22222222-2222-2222-2222-000000000003', '22222222-2222-2222-2222-222222222222', 'Tandir lavash', 'Tandir lavash - tez tayyorlanadigan mazali fast food tanlovi.', 35000, true, true, 3),
  ('22222222-2222-2222-2222-000000000004', '22222222-2222-2222-2222-222222222222', 'Club sandvich oddiy', 'Club sandvich oddiy - tez tayyorlanadigan mazali fast food tanlovi.', 30000, false, true, 4),
  ('22222222-2222-2222-2222-000000000005', '22222222-2222-2222-2222-222222222222', 'Club sandvich katta', 'Club sandvich katta - tez tayyorlanadigan mazali fast food tanlovi.', 40000, true, true, 5),
  ('22222222-2222-2222-2222-000000000006', '22222222-2222-2222-2222-222222222222', 'Xaggi oddiy', 'Xaggi oddiy - tez tayyorlanadigan mazali fast food tanlovi.', 24000, false, true, 6),
  ('22222222-2222-2222-2222-000000000007', '22222222-2222-2222-2222-222222222222', 'Xaggi katta', 'Xaggi katta - tez tayyorlanadigan mazali fast food tanlovi.', 30000, false, true, 7),
  ('22222222-2222-2222-2222-000000000008', '22222222-2222-2222-2222-222222222222', 'Non burger', 'Non burger - tez tayyorlanadigan mazali fast food tanlovi.', 27000, false, true, 8),
  ('22222222-2222-2222-2222-000000000009', '22222222-2222-2222-2222-222222222222', 'Hot dog', 'Hot dog - tez tayyorlanadigan mazali fast food tanlovi.', 17000, false, true, 9),
  ('22222222-2222-2222-2222-000000000010', '22222222-2222-2222-2222-222222222222', 'Shirin sosiska 2x', 'Shirin sosiska 2x - tez tayyorlanadigan mazali fast food tanlovi.', 22000, false, true, 10),
  ('33333333-3333-3333-3333-000000000001', '33333333-3333-3333-3333-333333333333', 'Tuxum', 'Tuxum - yengil tamaddi uchun qulay taom.', 3000, false, true, 1),
  ('33333333-3333-3333-3333-000000000002', '33333333-3333-3333-3333-333333333333', 'Shirin sosiska', 'Shirin sosiska - yengil tamaddi uchun qulay taom.', 6000, false, true, 2),
  ('33333333-3333-3333-3333-000000000003', '33333333-3333-3333-3333-333333333333', 'Olot somsa', 'Olot somsa - yengil tamaddi uchun qulay taom.', 10000, false, true, 3),
  ('33333333-3333-3333-3333-000000000004', '33333333-3333-3333-3333-333333333333', 'Sosiska barbekyu mol go''shtli', 'Sosiska barbekyu mol go''shtli - yengil tamaddi uchun qulay taom.', 14000, false, true, 4),
  ('33333333-3333-3333-3333-000000000005', '33333333-3333-3333-3333-333333333333', 'Sosiska barbekyu qo''y go''shtli', 'Sosiska barbekyu qo''y go''shtli - yengil tamaddi uchun qulay taom.', 14000, false, true, 5),
  ('33333333-3333-3333-3333-000000000006', '33333333-3333-3333-3333-333333333333', 'Ramen', 'Ramen - yengil tamaddi uchun qulay taom.', 25000, true, true, 6),
  ('33333333-3333-3333-3333-000000000007', '33333333-3333-3333-3333-333333333333', 'Go''shtli ramen', 'Go''shtli ramen - yengil tamaddi uchun qulay taom.', 32000, true, true, 7),
  ('33333333-3333-3333-3333-000000000008', '33333333-3333-3333-3333-333333333333', 'Bifshteks', 'Bifshteks - yengil tamaddi uchun qulay taom.', 35000, true, true, 8),
  ('33333333-3333-3333-3333-000000000009', '33333333-3333-3333-3333-333333333333', 'Befstrogan', 'Befstrogan - yengil tamaddi uchun qulay taom.', 40000, false, true, 9),
  ('33333333-3333-3333-3333-000000000010', '33333333-3333-3333-3333-333333333333', 'Naggets', 'Naggets - yengil tamaddi uchun qulay taom.', 20000, false, true, 10),
  ('33333333-3333-3333-3333-000000000011', '33333333-3333-3333-3333-333333333333', 'Fri', 'Fri - yengil tamaddi uchun qulay taom.', 20000, false, true, 11),
  ('33333333-3333-3333-3333-000000000012', '33333333-3333-3333-3333-333333333333', 'Meva assorti', 'Meva assorti - yengil tamaddi uchun qulay taom.', 47000, false, true, 12),
  ('33333333-3333-3333-3333-000000000013', '33333333-3333-3333-3333-333333333333', 'Mujskoy kapriz', 'Mujskoy kapriz - yengil tamaddi uchun qulay taom.', 43000, false, true, 13),
  ('33333333-3333-3333-3333-000000000014', '33333333-3333-3333-3333-333333333333', 'Qatiq', 'Qatiq - yengil tamaddi uchun qulay taom.', 4000, false, true, 14),
  ('33333333-3333-3333-3333-000000000015', '33333333-3333-3333-3333-333333333333', 'Salat', 'Salat - yengil tamaddi uchun qulay taom.', 8000, false, true, 15),
  ('33333333-3333-3333-3333-000000000016', '33333333-3333-3333-3333-333333333333', 'Bahor salat', 'Bahor salat - yengil tamaddi uchun qulay taom.', 7000, false, true, 16),
  ('44444444-4444-4444-4444-000000000001', '44444444-4444-4444-4444-444444444444', 'Peperoni', 'Peperoni - yangi pishiriladigan mazali pitsa.', 60000, true, true, 1),
  ('44444444-4444-4444-4444-000000000002', '44444444-4444-4444-4444-444444444444', 'Meksika', 'Meksika - yangi pishiriladigan mazali pitsa.', 65000, false, true, 2),
  ('44444444-4444-4444-4444-000000000003', '44444444-4444-4444-4444-444444444444', 'Qazili', 'Qazili - yangi pishiriladigan mazali pitsa.', 85000, true, true, 3),
  ('44444444-4444-4444-4444-000000000004', '44444444-4444-4444-4444-444444444444', 'Margarita', 'Margarita - yangi pishiriladigan mazali pitsa.', 45000, false, true, 4),
  ('44444444-4444-4444-4444-000000000005', '44444444-4444-4444-4444-444444444444', 'Lazzat assorti', 'Lazzat assorti - yangi pishiriladigan mazali pitsa.', 80000, true, true, 5),
  ('55555555-5555-5555-5555-000000000001', '55555555-5555-5555-5555-555555555555', 'Choko vafli oddiy', 'Choko vafli oddiy - shirasevarlar uchun yoqimli desert.', 25000, false, true, 1),
  ('55555555-5555-5555-5555-000000000002', '55555555-5555-5555-5555-555555555555', 'Choko vafli katta', 'Choko vafli katta - shirasevarlar uchun yoqimli desert.', 37000, true, true, 2),
  ('55555555-5555-5555-5555-000000000003', '55555555-5555-5555-5555-555555555555', 'Banan vafli oddiy', 'Banan vafli oddiy - shirasevarlar uchun yoqimli desert.', 30000, false, true, 3),
  ('55555555-5555-5555-5555-000000000004', '55555555-5555-5555-5555-555555555555', 'Banan vafli katta', 'Banan vafli katta - shirasevarlar uchun yoqimli desert.', 40000, true, true, 4),
  ('55555555-5555-5555-5555-000000000005', '55555555-5555-5555-5555-555555555555', 'Ananas vafli oddiy', 'Ananas vafli oddiy - shirasevarlar uchun yoqimli desert.', 30000, false, true, 5),
  ('55555555-5555-5555-5555-000000000006', '55555555-5555-5555-5555-555555555555', 'Ananas vafli katta', 'Ananas vafli katta - shirasevarlar uchun yoqimli desert.', 40000, false, true, 6),
  ('55555555-5555-5555-5555-000000000007', '55555555-5555-5555-5555-555555555555', 'Banan + ananas vafli oddiy', 'Banan + ananas vafli oddiy - shirasevarlar uchun yoqimli desert.', 35000, false, true, 7),
  ('55555555-5555-5555-5555-000000000008', '55555555-5555-5555-5555-555555555555', 'Banan + ananas vafli katta', 'Banan + ananas vafli katta - shirasevarlar uchun yoqimli desert.', 48000, true, true, 8),
  ('66666666-6666-6666-6666-000000000001', '66666666-6666-6666-6666-666666666666', 'Fanta 0.25L', 'Fanta 0.25L - tetiklantiruvchi ichimlik.', 5000, false, true, 1),
  ('66666666-6666-6666-6666-000000000002', '66666666-6666-6666-6666-666666666666', 'Fanta 0.5L', 'Fanta 0.5L - tetiklantiruvchi ichimlik.', 8000, true, true, 2),
  ('66666666-6666-6666-6666-000000000003', '66666666-6666-6666-6666-666666666666', 'Fanta 1L', 'Fanta 1L - tetiklantiruvchi ichimlik.', 12000, false, true, 3),
  ('66666666-6666-6666-6666-000000000004', '66666666-6666-6666-6666-666666666666', 'Fanta 1.5L', 'Fanta 1.5L - tetiklantiruvchi ichimlik.', 15000, false, true, 4),
  ('66666666-6666-6666-6666-000000000005', '66666666-6666-6666-6666-666666666666', 'Pepsi 0.25L', 'Pepsi 0.25L - tetiklantiruvchi ichimlik.', 5000, false, true, 5),
  ('66666666-6666-6666-6666-000000000006', '66666666-6666-6666-6666-666666666666', 'Pepsi 0.5L', 'Pepsi 0.5L - tetiklantiruvchi ichimlik.', 8000, true, true, 6),
  ('66666666-6666-6666-6666-000000000007', '66666666-6666-6666-6666-666666666666', 'Pepsi 1L', 'Pepsi 1L - tetiklantiruvchi ichimlik.', 12000, false, true, 7),
  ('66666666-6666-6666-6666-000000000008', '66666666-6666-6666-6666-666666666666', 'Pepsi 1.5L', 'Pepsi 1.5L - tetiklantiruvchi ichimlik.', 15000, false, true, 8),
  ('66666666-6666-6666-6666-000000000009', '66666666-6666-6666-6666-666666666666', 'Sochnaya Dolina', 'Sochnaya Dolina - tetiklantiruvchi ichimlik.', 14000, false, true, 9),
  ('66666666-6666-6666-6666-000000000010', '66666666-6666-6666-6666-666666666666', 'Lipton 0.5L', 'Lipton 0.5L - tetiklantiruvchi ichimlik.', 8000, false, true, 10),
  ('66666666-6666-6666-6666-000000000011', '66666666-6666-6666-6666-666666666666', 'Lipton 1L', 'Lipton 1L - tetiklantiruvchi ichimlik.', 12000, false, true, 11),
  ('66666666-6666-6666-6666-000000000012', '66666666-6666-6666-6666-666666666666', 'Suv 0.5L', 'Suv 0.5L - tetiklantiruvchi ichimlik.', 4000, false, true, 12),
  ('66666666-6666-6666-6666-000000000013', '66666666-6666-6666-6666-666666666666', 'Suv 1L', 'Suv 1L - tetiklantiruvchi ichimlik.', 5000, false, true, 13),
  ('66666666-6666-6666-6666-000000000014', '66666666-6666-6666-6666-666666666666', 'Dinay 0.5L', 'Dinay 0.5L - tetiklantiruvchi ichimlik.', 10000, false, true, 14),
  ('66666666-6666-6666-6666-000000000015', '66666666-6666-6666-6666-666666666666', 'Dinay 1L', 'Dinay 1L - tetiklantiruvchi ichimlik.', 15000, false, true, 15),
  ('66666666-6666-6666-6666-000000000016', '66666666-6666-6666-6666-666666666666', 'Adrenaline kichik', 'Adrenaline kichik - tetiklantiruvchi ichimlik.', 12000, false, true, 16),
  ('66666666-6666-6666-6666-000000000017', '66666666-6666-6666-6666-666666666666', 'Adrenaline katta', 'Adrenaline katta - tetiklantiruvchi ichimlik.', 15000, true, true, 17),
  ('77777777-7777-7777-7777-000000000001', '77777777-7777-7777-7777-777777777777', 'Kapuchino', 'Kapuchino - xushbo''y issiq kofe ichimligi.', 8000, true, true, 1),
  ('77777777-7777-7777-7777-000000000002', '77777777-7777-7777-7777-777777777777', 'Hot chocolate', 'Hot chocolate - xushbo''y issiq kofe ichimligi.', 8000, true, true, 2),
  ('77777777-7777-7777-7777-000000000003', '77777777-7777-7777-7777-777777777777', 'Coffee mix', 'Coffee mix - xushbo''y issiq kofe ichimligi.', 8000, false, true, 3),
  ('88888888-8888-8888-8888-000000000001', '88888888-8888-8888-8888-888888888888', 'Tarxun', 'Tarxun - ichimlik menyusidagi mashhur tanlov.', 10000, false, true, 1),
  ('88888888-8888-8888-8888-000000000002', '88888888-8888-8888-8888-888888888888', 'Dyushes', 'Dyushes - ichimlik menyusidagi mashhur tanlov.', 10000, false, true, 2),
  ('88888888-8888-8888-8888-000000000003', '88888888-8888-8888-8888-888888888888', 'Apelsin', 'Apelsin - ichimlik menyusidagi mashhur tanlov.', 10000, false, true, 3),
  ('88888888-8888-8888-8888-000000000004', '88888888-8888-8888-8888-888888888888', 'Sutli kokteyl', 'Sutli kokteyl - ichimlik menyusidagi mashhur tanlov.', 18000, true, true, 4),
  ('88888888-8888-8888-8888-000000000005', '88888888-8888-8888-8888-888888888888', 'Malina kokteyl', 'Malina kokteyl - ichimlik menyusidagi mashhur tanlov.', 18000, false, true, 5),
  ('88888888-8888-8888-8888-000000000006', '88888888-8888-8888-8888-888888888888', 'Shokolad kokteyl', 'Shokolad kokteyl - ichimlik menyusidagi mashhur tanlov.', 18000, false, true, 6),
  ('88888888-8888-8888-8888-000000000007', '88888888-8888-8888-8888-888888888888', 'Novvot choy', 'Novvot choy - ichimlik menyusidagi mashhur tanlov.', 4000, false, true, 7),
  ('88888888-8888-8888-8888-000000000008', '88888888-8888-8888-8888-888888888888', 'Limon choy oddiy', 'Limon choy oddiy - ichimlik menyusidagi mashhur tanlov.', 6000, false, true, 8),
  ('88888888-8888-8888-8888-000000000009', '88888888-8888-8888-8888-888888888888', 'Limon choy katta', 'Limon choy katta - ichimlik menyusidagi mashhur tanlov.', 8000, false, true, 9),
  ('88888888-8888-8888-8888-000000000010', '88888888-8888-8888-8888-888888888888', 'Mevali choy oddiy', 'Mevali choy oddiy - ichimlik menyusidagi mashhur tanlov.', 12000, false, true, 10),
  ('88888888-8888-8888-8888-000000000011', '88888888-8888-8888-8888-888888888888', 'Mevali choy katta', 'Mevali choy katta - ichimlik menyusidagi mashhur tanlov.', 22000, true, true, 11),
  ('88888888-8888-8888-8888-000000000012', '88888888-8888-8888-8888-888888888888', 'Bardak choy', 'Bardak choy - ichimlik menyusidagi mashhur tanlov.', 5000, true, true, 12)
on conflict (id) do update
set
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  is_popular = excluded.is_popular,
  is_available = excluded.is_available,
  sort_order = excluded.sort_order;


