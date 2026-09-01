-- Access rules for the HQ Website Builder control plane.
--
-- These sixteen tables shipped with no row level security and no policies. In Supabase
-- a public table without RLS is reachable through PostgREST, so this is the difference
-- between a dealership's website content being private and being readable by anyone
-- holding an authenticated token. docs/rls-standard.md states the rule plainly: no
-- table ships without RLS.
--
-- Tenancy here is unusual and drove the design. `site_id` is TEXT with a default of
-- 'marketsync_corporate', not a UUID foreign key to dealerships: this began as the
-- control plane for MarketSync's own corporate site, and dealer sites reuse it by
-- writing a dealership UUID into that text column. So a row is one of two things:
--
--   * a dealership's row  -> site_id parses as a UUID, and normal per-dealership
--                            permission applies
--   * an internal row     -> site_id is 'marketsync_corporate' or any other
--                            non-UUID label, and only platform staff may read it
--
-- authz.website_site_dealership() encodes exactly that split. It returns NULL for
-- anything that is not a UUID, and authz.has_permission() already returns false for a
-- NULL dealership, so internal rows fall through to the platform-staff branch rather
-- than leaking. The cast is guarded because an unguarded site_id::uuid would raise on
-- the first corporate row and fail the whole query, not just hide it.
--
-- Reads are permission-gated on `site.manage`, the only site permission in the
-- catalogue - no new permission string is introduced. Writes stay backend-mediated
-- through supabaseAdmin (service_role carries BYPASSRLS), matching how the Website
-- Builder routes already operate; `authenticated` gets no write grant at all.

create or replace function authz.website_site_dealership(p_site_id text)
returns uuid language sql immutable
set search_path to 'pg_catalog'
as $function$
  select case
    when p_site_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then p_site_id::uuid
    else null
  end
$function$;

-- Parent resolvers for the child tables, mirroring authz.inventory_dealership().
create or replace function authz.website_page_site(p_page_id uuid)
returns text language sql stable security definer set search_path to 'public', 'pg_temp'
as $function$ select site_id from public.website_pages where id = p_page_id $function$;

create or replace function authz.website_post_site(p_post_id uuid)
returns text language sql stable security definer set search_path to 'public', 'pg_temp'
as $function$ select site_id from public.website_posts where id = p_post_id $function$;

create or replace function authz.website_navigation_site(p_navigation_id uuid)
returns text language sql stable security definer set search_path to 'public', 'pg_temp'
as $function$ select site_id from public.website_navigation where id = p_navigation_id $function$;

create or replace function authz.website_scan_site(p_scan_id uuid)
returns text language sql stable security definer set search_path to 'public', 'pg_temp'
as $function$ select site_id from public.website_discovery_scans where id = p_scan_id $function$;

create or replace function authz.website_change_set_site(p_change_set_id uuid)
returns text language sql stable security definer set search_path to 'public', 'pg_temp'
as $function$ select site_id from public.website_change_sets where id = p_change_set_id $function$;

-- Tables that carry site_id directly.
do $$
declare
  own_tables text[] := array[
    'website_pages',
    'website_posts',
    'website_media',
    'website_navigation',
    'website_redirects',
    'website_design_tokens',
    'website_seo_settings',
    'website_discovery_scans',
    'website_change_sets',
    'website_deployments'
  ];
  t text;
begin
  foreach t in array own_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_select_authorized', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ('
      || 'authz.has_permission(authz.website_site_dealership(site_id), %L) or authz.is_platform_staff())',
      t || '_select_authorized', t, 'site.manage'
    );
  end loop;
end $$;

-- Child tables resolve their parent's site_id.
do $$
declare
  child_tables text[][] := array[
    array['website_page_versions', 'page_id', 'website_page_site'],
    array['website_sections', 'page_id', 'website_page_site'],
    array['website_post_versions', 'post_id', 'website_post_site'],
    array['website_navigation_items', 'navigation_id', 'website_navigation_site'],
    array['website_discovery_findings', 'scan_id', 'website_scan_site'],
    array['website_change_set_items', 'change_set_id', 'website_change_set_site']
  ];
  i int;
  t text;
  col text;
  fn text;
begin
  for i in 1 .. array_length(child_tables, 1) loop
    t := child_tables[i][1];
    col := child_tables[i][2];
    fn := child_tables[i][3];
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_select_authorized', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ('
      || 'authz.has_permission(authz.website_site_dealership(authz.%I(%I)), %L) or authz.is_platform_staff())',
      t || '_select_authorized', t, fn, col, 'site.manage'
    );
  end loop;
end $$;
