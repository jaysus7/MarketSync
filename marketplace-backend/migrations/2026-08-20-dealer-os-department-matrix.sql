-- Align persisted DealerOS entitlements with the public Core / Pro / Complete ladder.
-- Navigation remains role-gated; this migration only changes package capabilities.

-- Core contains the complete Sales Marketing Suite, including Video.
insert into public.plan_products (plan_id, product_id)
values ('dealer-os-core', 'marketsync_video')
on conflict (plan_id, product_id) do nothing;

insert into public.plan_features (plan_id, feature_id)
select 'dealer-os-core', id
from public.features
where product_id = 'marketsync_video'
on conflict (plan_id, feature_id) do nothing;

-- HR/People is a Complete department. Team Messaging is intentionally independent
-- of os.team and remains available to every DealerOS tier.
delete from public.plan_features
where plan_id = 'dealer-os-pro' and feature_id = 'os.team';

insert into public.plan_features (plan_id, feature_id)
values ('dealer-os-complete', 'os.team')
on conflict (plan_id, feature_id) do nothing;
