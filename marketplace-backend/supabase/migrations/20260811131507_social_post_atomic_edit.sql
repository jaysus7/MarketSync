-- Edit a logical Social post and its provider targets as one database transaction.
-- The worker claim locks target rows with SKIP LOCKED. This function takes compatible row
-- locks before it checks state, so either the edit wins in full or the claim wins and the
-- edit is refused. There is never a half-edited target set visible to a publisher.
create or replace function public.social_edit_post_atomic(
  p_dealership_id uuid,
  p_post_id uuid,
  p_patch jsonb default '{}'::jsonb,
  p_targets jsonb default null
) returns public.social_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.social_posts;
  v_content_changed boolean;
  v_scheduled_for timestamptz;
  v_status text;
begin
  select * into v_post
  from public.social_posts
  where id = p_post_id
    and dealership_id = p_dealership_id
    and deleted_at is null
  for update;

  if not found then raise exception 'Post not found'; end if;
  if v_post.status not in ('draft', 'needs_approval', 'scheduled', 'failed') then
    raise exception 'Publishing has started; this post can no longer be edited.';
  end if;

  -- Claim and edit serialize on these rows. Re-check after acquiring the locks because a
  -- worker may have won immediately before this transaction.
  perform 1 from public.social_post_targets where post_id = p_post_id for update;
  if exists (
    select 1 from public.social_post_targets
    where post_id = p_post_id and status in ('publishing', 'published')
  ) then
    raise exception 'Publishing has started; claimed targets cannot be changed.';
  end if;

  if p_targets is not null then
    if jsonb_typeof(p_targets) <> 'array' or jsonb_array_length(p_targets) = 0 then
      raise exception 'A post needs at least one account to publish to.';
    end if;
  end if;

  -- The duplicate check is written separately because PL/pgSQL cannot assign two aggregate
  -- results to the same variable without obscuring which invariant failed.
  if p_targets is not null and (
    select count(*) <> count(distinct (x->>'social_account_id')::uuid)
    from jsonb_array_elements(p_targets) x
  ) then raise exception 'A social account may be targeted only once.'; end if;

  if p_targets is not null and exists (
    select 1
    from jsonb_array_elements(p_targets) x
    left join public.social_accounts a
      on a.id = (x->>'social_account_id')::uuid
     and a.dealership_id = p_dealership_id
    where a.id is null
  ) then raise exception 'A target account is not available to this dealership.'; end if;

  v_content_changed := p_targets is not null
    or p_patch ?| array['body', 'media', 'campaign_id', 'inventory_id'];
  v_scheduled_for := case when p_patch ? 'scheduled_for'
    then nullif(p_patch->>'scheduled_for', '')::timestamptz else v_post.scheduled_for end;
  v_status := case
    when v_post.requires_approval and (v_post.approved_at is null or v_content_changed) then 'needs_approval'
    when v_scheduled_for is null then 'draft'
    else 'scheduled'
  end;

  update public.social_posts set
    body = case when p_patch ? 'body' then nullif(p_patch->>'body', '') else body end,
    media = case when p_patch ? 'media' then coalesce(p_patch->'media', '[]'::jsonb) else media end,
    campaign_id = case when p_patch ? 'campaign_id' then nullif(p_patch->>'campaign_id', '')::uuid else campaign_id end,
    inventory_id = case when p_patch ? 'inventory_id' then nullif(p_patch->>'inventory_id', '')::uuid else inventory_id end,
    scheduled_for = v_scheduled_for,
    status = v_status,
    approved_by = case when v_content_changed then null else approved_by end,
    approved_at = case when v_content_changed then null else approved_at end,
    updated_at = now()
  where id = p_post_id and dealership_id = p_dealership_id
  returning * into v_post;

  if p_targets is not null then
    delete from public.social_post_targets
    where post_id = p_post_id and dealership_id = p_dealership_id;

    insert into public.social_post_targets (
      dealership_id, post_id, social_account_id, body_override
    )
    select p_dealership_id, p_post_id,
      (x->>'social_account_id')::uuid,
      nullif(x->>'body_override', '')
    from jsonb_array_elements(p_targets) x;
  end if;

  return v_post;
end;
$$;

revoke all on function public.social_edit_post_atomic(uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.social_edit_post_atomic(uuid, uuid, jsonb, jsonb)
  to service_role;
