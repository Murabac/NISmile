-- Sample data for step 12 (stock counts).
-- Skips catalog/purchases/transfers. Completes one small variance count on gloves.
-- Safe to re-run.

do $$
declare
  v_branch_id uuid;
  v_count_id uuid;
  v_gloves uuid;
  v_line_id uuid;
  v_system numeric;
begin
  select id into v_branch_id
  from dental.branches
  where active
  order by created_at
  limit 1;

  if v_branch_id is null then
    raise exception 'No active branch.';
  end if;

  select id into v_gloves from dental.items where sku = 'CON-GLV-M100';
  if v_gloves is null then
    raise exception 'Gloves item missing.';
  end if;

  if exists (
    select 1 from dental.stock_counts
    where branch_id = v_branch_id
      and notes = 'SEED-STOCK-COUNT'
  ) then
    return;
  end if;

  -- Cancel any other open draft so create can run.
  update dental.stock_counts
  set status = 'cancelled'
  where branch_id = v_branch_id
    and status = 'draft';

  v_count_id := dental.create_stock_count(v_branch_id, 'SEED-STOCK-COUNT');

  select id, system_qty into v_line_id, v_system
  from dental.stock_count_lines
  where stock_count_id = v_count_id
    and item_id = v_gloves;

  if v_line_id is null then
    raise exception 'Gloves line missing from count snapshot.';
  end if;

  -- Leave other lines equal to system; gloves short by 1.
  perform dental.save_stock_count_lines(
    v_count_id,
    (
      select jsonb_agg(
        jsonb_build_object(
          'line_id', l.id,
          'counted_qty',
          case
            when l.item_id = v_gloves then greatest(l.system_qty - 1, 0)
            else l.system_qty
          end
        )
      )
      from dental.stock_count_lines l
      where l.stock_count_id = v_count_id
    )
  );

  perform dental.complete_stock_count(v_count_id);
end $$;
