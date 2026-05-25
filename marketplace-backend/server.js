import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT || 10000;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

app.use(cors());

// ── 1. STRIPE WEBHOOK LAYER ──
app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const sub = await stripe.subscriptions.retrieve(session.subscription);
      await supabase.from('dealerships').update({
        stripe_customer_id: session.customer,
        subscription_id: session.subscription,
        stripe_price_id: sub.items.data[0].price.id,
        billing_status: 'ACTIVE'
      }).eq('id', session.client_reference_id);
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      await supabase.from('dealerships').update({ billing_status: 'INACTIVE' }).eq('subscription_id', subscription.id);
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      if (invoice.subscription) {
        await supabase.from('dealerships').update({ billing_status: 'PAST_DUE' }).eq('stripe_customer_id', invoice.customer);
      }
      break;
    }
  }
  res.json({ received: true });
});

app.use(express.json());

// ── 2. AUTH & SUBSCRIPTION GATE ──────────────
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid token' });

    const { data: profile, error: pErr } = await supabase.from('profiles').select('*, dealerships(*)').eq('id', user.id).single();
    if (pErr || !profile) return res.status(401).json({ error: 'Profile not found' });

    if (profile.dealerships?.billing_status === 'INACTIVE' || profile.dealerships?.billing_status === 'PAST_DUE') {
      return res.status(402).json({ error: 'SUBSCRIPTION_REQUIRED' });
    }

    req.user = user;
    req.profile = profile;
    req.dealershipId = profile.dealership_id;
    next();
  } catch (err) { return res.status(500).json({ error: 'Internal auth error' }); }
}

// ── 3. AUTHENTICATION & REGISTRATION ENDPOINTS ───────────────────
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ access_token: data.session.access_token, user: data.user });
});

app.post('/auth/register', async (req, res) => {
  const { email, password, fullName, dealershipName, websiteUrl } = req.body;
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
  if (authError) return res.status(400).json({ error: authError.message });

  const { data: dealer, error: dErr } = await supabase.from('dealerships')
    .insert({ name: dealershipName, website_url: websiteUrl, billing_status: 'TRIAL' }).select().single();
  if (dErr) return res.status(500).json({ error: dErr.message });

  await supabase.from('profiles').insert({ id: authData.user.id, full_name: fullName, dealership_id: dealer.id, role: 'DEALER_ADMIN' });
  res.status(201).json({ message: 'Success', dealer });
});

app.put('/profile/update', requireAuth, async (req, res) => {
  const { websiteUrl, fullName } = req.body;
  if (websiteUrl) await supabase.from('dealerships').update({ website_url: websiteUrl }).eq('id', req.dealershipId);
  if (fullName) await supabase.from('profiles').update({ full_name: fullName }).eq('id', req.user.id);
  res.json({ message: 'Updated' });
});

// ── 4. CORE DATA ROUTES ─────────────────────────────
app.get('/inventory', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('inventory').select('*').eq('dealership_id', req.dealershipId).order('created_at', { ascending: false });
  res.json(data || []);
});

app.post('/listings', requireAuth, async (req, res) => {
  const { inventory_id, fb_listing_id, fb_listing_url } = req.body;
  const { data, error } = await supabase.from('listings').insert([{ inventory_id, fb_listing_id, fb_listing_url, posted_by: req.user.id, status: 'ACTIVE' }]).select();
  res.status(201).json(data[0]);
});

// ── 5. BILLING MANAGEMENT ──────────────────────
app.post('/billing/checkout', requireAuth, async (req, res) => {
  const { priceId } = req.body; // Frontend now sends either STRIPE_DEALER_PRICE_ID or STRIPE_SOLO_PRICE_ID
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    client_reference_id: req.dealershipId,
    success_url: `${process.env.FRONTEND_URL}/dashboard`,
    cancel_url: `${process.env.FRONTEND_URL}/upgrade`,
  });
  res.json({ url: session.url });
});

// ── 6. PROXY & INSIGHTS ──
app.get('/proxy-image', async (req, res) => {
  const response = await fetch(req.query.url);
  res.send(Buffer.from(await response.arrayBuffer()));
});

app.get('/dealership/team-insights', requireAuth, async (req, res) => {
  if (req.profile.role !== 'DEALER_ADMIN') return res.status(403).json({ error: 'Unauthorized' });
  const { data } = await supabase.from('profiles').select('full_name, id, listings(count)').eq('dealership_id', req.dealershipId);
  res.json(data);
});

app.listen(PORT, () => console.log(`🚀 Production server live on port ${PORT}`));