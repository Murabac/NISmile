-- Sample for steps 26–28. No invented rates.
-- Ensures clinic_settings.go_live exists and records a seed marker.
-- Reports/dashboard use existing sales/stock/appointment seed data.

do $$
declare
  v_id uuid;
begin
  insert into dental.clinic_settings (id)
  select gen_random_uuid()
  where not exists (select 1 from dental.clinic_settings);

  select id into v_id from dental.clinic_settings order by created_at limit 1;

  update dental.clinic_settings
  set
    go_live = coalesce(go_live, '{}'::jsonb) || jsonb_build_object(
      'seed_marker', 'SEED-GO-LIVE',
      'backup_confirmed', false,
      'roles_trained', false,
      'templates_reviewed', false,
      'quality_rating_watched', false
    ),
    updated_at = now()
  where id = v_id
    and coalesce(go_live->>'seed_marker', '') <> 'SEED-GO-LIVE';
end $$;
