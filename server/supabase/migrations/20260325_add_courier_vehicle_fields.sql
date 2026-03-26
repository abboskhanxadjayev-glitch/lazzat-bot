alter table if exists public.couriers
  add column if not exists transport_color text,
  add column if not exists vehicle_brand text,
  add column if not exists plate_number text;

create index if not exists couriers_transport_color_idx on public.couriers(transport_color);
create index if not exists couriers_vehicle_brand_idx on public.couriers(vehicle_brand);
create index if not exists couriers_plate_number_idx on public.couriers(plate_number);
