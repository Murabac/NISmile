-- Step 38: branch regions + manual SLSH/ETB FX rates (USD remains ledger).
-- Rates are units of foreign currency per 1 USD. Blank = omit foreign on docs.
-- Do not invent default rates.

do $$ begin
  create type dental.branch_region as enum ('somaliland', 'ethiopia');
exception when duplicate_object then null;
end $$;

alter table dental.branches
  add column if not exists region dental.branch_region not null default 'somaliland';

comment on column dental.branches.region is
  'Somaliland docs show USD+SLSH; Ethiopia docs show USD+ETB.';

alter table dental.clinic_settings
  add column if not exists fx_slsh_per_usd numeric(18, 6)
    check (fx_slsh_per_usd is null or fx_slsh_per_usd > 0),
  add column if not exists fx_etb_per_usd numeric(18, 6)
    check (fx_etb_per_usd is null or fx_etb_per_usd > 0),
  add column if not exists fx_rates_updated_at timestamptz;

comment on column dental.clinic_settings.fx_slsh_per_usd is
  'Somaliland shillings per 1 USD. Null until owner sets.';
comment on column dental.clinic_settings.fx_etb_per_usd is
  'Ethiopian birr per 1 USD. Null until owner sets.';

-- Existing branches (e.g. Hargeisa) stay somaliland via default.

drop function if exists dental.update_clinic_settings(
  numeric, numeric, numeric, numeric, integer, boolean, boolean, boolean, boolean, boolean
);

create or replace function dental.update_clinic_settings(
  p_vat_percent numeric default null,
  p_loyalty_earn_per_usd numeric default null,
  p_loyalty_usd_per_point numeric default null,
  p_loyalty_min_redeem_points numeric default null,
  p_loyalty_expire_days integer default null,
  p_clear_vat boolean default false,
  p_clear_loyalty_earn boolean default false,
  p_clear_loyalty_redeem boolean default false,
  p_clear_loyalty_min boolean default false,
  p_clear_loyalty_expire boolean default false,
  p_fx_slsh_per_usd numeric default null,
  p_fx_etb_per_usd numeric default null,
  p_clear_fx_slsh boolean default false,
  p_clear_fx_etb boolean default false
)
returns dental.clinic_settings
language plpgsql
security definer
set search_path = dental
as $$
declare
  v_row dental.clinic_settings%rowtype;
  v_fx_touched boolean := false;
begin
  if not dental.is_owner() then
    raise exception 'Only the owner can update clinic settings';
  end if;

  insert into dental.clinic_settings (id)
  select gen_random_uuid()
  where not exists (select 1 from dental.clinic_settings);

  if p_clear_fx_slsh or p_fx_slsh_per_usd is not null
     or p_clear_fx_etb or p_fx_etb_per_usd is not null then
    v_fx_touched := true;
  end if;

  update dental.clinic_settings
  set
    vat_percent = case
      when p_clear_vat then null
      when p_vat_percent is not null then p_vat_percent
      else vat_percent
    end,
    loyalty_earn_per_usd = case
      when p_clear_loyalty_earn then null
      when p_loyalty_earn_per_usd is not null then p_loyalty_earn_per_usd
      else loyalty_earn_per_usd
    end,
    loyalty_usd_per_point = case
      when p_clear_loyalty_redeem then null
      when p_loyalty_usd_per_point is not null then p_loyalty_usd_per_point
      else loyalty_usd_per_point
    end,
    loyalty_min_redeem_points = case
      when p_clear_loyalty_min then null
      when p_loyalty_min_redeem_points is not null then p_loyalty_min_redeem_points
      else loyalty_min_redeem_points
    end,
    loyalty_expire_days = case
      when p_clear_loyalty_expire then null
      when p_loyalty_expire_days is not null then p_loyalty_expire_days
      else loyalty_expire_days
    end,
    fx_slsh_per_usd = case
      when p_clear_fx_slsh then null
      when p_fx_slsh_per_usd is not null then p_fx_slsh_per_usd
      else fx_slsh_per_usd
    end,
    fx_etb_per_usd = case
      when p_clear_fx_etb then null
      when p_fx_etb_per_usd is not null then p_fx_etb_per_usd
      else fx_etb_per_usd
    end,
    fx_rates_updated_at = case
      when v_fx_touched then now()
      else fx_rates_updated_at
    end,
    updated_by = auth.uid(),
    updated_at = now()
  where id = (select id from dental.clinic_settings order by created_at limit 1)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function dental.update_clinic_settings(
  numeric, numeric, numeric, numeric, integer,
  boolean, boolean, boolean, boolean, boolean,
  numeric, numeric, boolean, boolean
) from public;
grant execute on function dental.update_clinic_settings(
  numeric, numeric, numeric, numeric, integer,
  boolean, boolean, boolean, boolean, boolean,
  numeric, numeric, boolean, boolean
) to authenticated, service_role;
