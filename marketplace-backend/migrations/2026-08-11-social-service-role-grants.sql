-- Social routes and the publisher worker use the server-side Supabase client. RLS continues
-- to govern authenticated browser callers; the trusted backend needs explicit table grants.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.social_accounts,
           public.social_account_grants,
           public.social_posts,
           public.social_post_targets
  TO service_role;
