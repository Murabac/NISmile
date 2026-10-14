-- Sample campaign for step 25.
-- Enqueues promotion_announcement for opt-in audience of RETAIL-HYG-15 (or WS fallback).
-- Skips if sample campaign already exists. Safe to re-run.

do $$
declare
  v_promo_id uuid;
  v_campaign_id uuid;
  v_exists uuid;
  v_count integer;
begin
  select id into v_exists
  from dental.campaigns
  where name like 'SEED-CAMPAIGN:%'
  limit 1;
  if v_exists is not null then
    raise notice 'Seed campaign already present.';
    return;
  end if;

  select id into v_promo_id
  from dental.promotions
  where code = 'RETAIL-HYG-15' and notify_whatsapp
  limit 1;

  if v_promo_id is null then
    select id into v_promo_id
    from dental.promotions
    where code = 'WS-BOX10-FREE1' and notify_whatsapp
    limit 1;
  end if;

  if v_promo_id is null then
    raise notice 'No notify_whatsapp sample promotion; skip campaign seed.';
    return;
  end if;

  select count(*)::integer into v_count
  from dental.list_promotion_audience(v_promo_id);

  if v_count = 0 then
    raise notice 'No opt-in audience for sample promo; create campaign draft only.';
    insert into dental.campaigns (
      name, promotion_id, kind, status, scheduled_at, target_count, enqueued_count
    )
    values (
      'SEED-CAMPAIGN: preview empty audience',
      v_promo_id,
      'promotion_announcement',
      'draft',
      now(),
      0,
      0
    );
    return;
  end if;

  v_campaign_id := dental.enqueue_promotion_campaign(
    v_promo_id,
    'promotion_announcement',
    now(),
    'SEED-CAMPAIGN: Hygiene / wholesale announce'
  );

  raise notice 'Seed campaign % enqueued for % recipients', v_campaign_id, v_count;
end $$;
