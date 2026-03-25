create extension if not exists pgcrypto;

alter table if exists public.couriers
  add column if not exists transport_type text;

alter table if exists public.couriers
  add column if not exists online_status text not null default 'offline';

create index if not exists couriers_online_status_idx on public.couriers(online_status);
