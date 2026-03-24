create extension if not exists pgcrypto;

create table if not exists public.couriers (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique,
  username text,
  full_name text not null,
  phone text,
  status text not null default 'pending',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.orders
  add column if not exists courier_id uuid references public.couriers(id) on delete set null;

alter table if exists public.orders
  add column if not exists assigned_at timestamptz;

create index if not exists couriers_status_idx on public.couriers(status);
create index if not exists orders_courier_id_idx on public.orders(courier_id);
create index if not exists orders_assigned_at_idx on public.orders(assigned_at);
