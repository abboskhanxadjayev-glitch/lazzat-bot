alter table if exists public.orders
  add column if not exists payment_method text not null default 'cash';

alter table if exists public.orders
  add column if not exists payment_status text not null default 'pending';

create index if not exists orders_payment_method_idx on public.orders(payment_method);
create index if not exists orders_payment_status_idx on public.orders(payment_status);
