alter table if exists public.couriers
  add column if not exists base_latitude double precision,
  add column if not exists base_longitude double precision;

alter table if exists public.orders
  add column if not exists assignment_method text,
  add column if not exists assignment_distance_km double precision;