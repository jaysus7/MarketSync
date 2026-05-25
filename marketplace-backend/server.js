import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT || 10000;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// ── MIDDLEWARE: AUTH & SUBSCRIPTION GATE ──
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('*, dealerships(*)')
    .eq('id', user.id)
    .single();

  if (pErr || !profile) return res.status(401).json({ error: 'Profile not found' });

  req.user = user;
  req.profile = profile;
  req.dealershipId = profile.dealership_id;
  next();
}

async function checkAccess(req, res, next) {
  const { data: dealership } = await supabase
    .from('dealerships')
    .select('billing_status')
    .eq('id', req.dealershipId)
    .single();

  if (dealership?.billing_status !== 'ACTIVE') {
    return res.status(402).json({ error: 'SUBSCRIPTION_REQUIRED' });
  }
  next();
}

// ── 1. STRIPE WEBHOOK ──
app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const sub = await stripe.subscriptions.retrieve(session.subscription);
    await supabase.from('dealerships').update({
      stripe_customer_id: session.customer,
      subscription_id: session.subscription,
      stripe_price_id: sub.items.data[0].price.id,
      billing_status: 'ACTIVE'
    }).eq('id', session.client_reference_id);
  }
  res.json({ received: true });
});

// ── 2. AUTH & REGISTRATION ──
app.post('/auth/register', async (req, res) => {
  const { email, password, fullName, dealershipName } = req.body;
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) throw authError;

    const { data: dealer, error: dealerError } = await supabase
      .from('dealerships')
      .insert({ name: dealershipName, billing_status: 'TRIAL' })
      .select().single();
    if (dealerError) throw dealerError;

    await supabase.from('profiles').insert({ 
      id: authData.user.id, full_name: fullName, dealership_id: dealer.id, role: 'DEALER_ADMIN' 
    });

    res.status(201).json({ message: 'Success', dealer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 3. BILLING ENDPOINTS ──
app.post('/billing/checkout', requireAuth, async (req, res) => {
  const { priceId } = req.body;
  const validPrices = [process.env.STRIPE_DEALER_PRICE_ID, process.env.STRIPE_SOLO_PRICE_ID];
  if (!validPrices.includes(priceId)) return res.status(400).json({ error: 'Invalid plan' });

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

// ── 4. SECURE ROUTES ──
app.get('/dealership/team-insights', requireAuth, checkAccess, async (req, res) => {
  if (req.profile.role !== 'DEALER_ADMIN') return res.status(403).json({ error: 'Unauthorized' });

  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, id, listings(count)')
    .eq('dealership_id', req.dealershipId);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── 5. RUNTIME ──
app.listen(PORT, () => console.log(`🚀 Production server live on port ${PORT}`));