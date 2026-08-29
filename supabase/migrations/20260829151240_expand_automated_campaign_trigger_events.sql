ALTER TABLE public.automated_campaigns
DROP CONSTRAINT IF EXISTS automated_campaigns_trigger_event_check;

ALTER TABLE public.automated_campaigns
ADD CONSTRAINT automated_campaigns_trigger_event_check
CHECK (trigger_event = ANY (ARRAY[
  'internet_lead'::text,
  'appointment_booked'::text,
  'show_no_sale'::text,
  'delivered'::text,
  'birthday'::text,
  'holiday'::text,
  'equity'::text,
  'inventory_aged'::text,
  'service_lapsed'::text,
  'lease_maturity'::text,
  'declined_service'::text
]));
