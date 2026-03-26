alter table if exists public.couriers
  add column if not exists password_hash text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'couriers_phone_key'
  ) then
    if not exists (
      select phone
      from public.couriers
      where phone is not null
        and btrim(phone) <> ''
      group by phone
      having count(*) > 1
    ) then
      alter table public.couriers
        add constraint couriers_phone_key unique (phone);
    else
      raise notice 'Skipping couriers_phone_key creation because duplicate phone values already exist.';
    end if;
  end if;
end $$;
