const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase - user needs to set these env vars
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_xxx');

app.use(express.json());
app.use(express.static('public'));

// Stripe webhook - needs raw body
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { tier, userId } = session.metadata || {};
    
    if (tier && userId) {
      await supabase.from('profiles').update({ tier }).eq('id', userId);
      console.log(`Upgraded user ${userId} to ${tier}`);
    }
  }
  
  res.json({ received: true });
});

// Auth middleware via Supabase
async function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });
  
  req.user = user;
  next();
}

// Get user's tier from profiles table
async function getUserTier(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', userId)
    .single();
  return data?.tier || 'starter';
}

const TIER_ACCESS = {
  starter: ['shotlist', 'storyboard'],
  indie: ['shotlist', 'storyboard', 'budget', 'locationscout'],
  pro: ['shotlist', 'storyboard', 'budget', 'locationscout', 'equipment', 'callsheet', 'invoice']
};

const PRICING = {
  starter: { price: 0, name: 'Starter' },
  indie: { price: 12, name: 'Indie', discount: 25 },
  pro: { price: 25, name: 'Pro', discount: 45 }
};

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  
  // Create profile
  await supabase.from('profiles').insert([{
    id: data.user.id,
    name,
    tier: 'starter'
  }]);
  
  res.json({ user: data.user, session: data.session });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });
  
  res.json({ user: data.user, session: data.session });
});

app.post('/api/auth/logout', auth, async (req, res) => {
  await supabase.auth.signOut();
  res.json({ success: true });
});

// Get current user
app.get('/api/me', auth, async (req, res) => {
  const tier = await getUserTier(req.user.id);
  res.json({ user: { ...req.user, tier } });
});

// Get pricing
app.get('/api/pricing', (req, res) => {
  res.json({ pricing: PRICING });
});

// Get accessible tools
app.get('/api/tools', auth, async (req, res) => {
  const tier = await getUserTier(req.user.id);
  res.json({ tools: TIER_ACCESS[tier], tier, pricing: PRICING[tier] });
});

// Projects CRUD
app.get('/api/projects', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ projects: data });
});

app.post('/api/projects', auth, async (req, res) => {
  const { name, type, data } = req.body;
  const tier = await getUserTier(req.user.id);
  
  if (!TIER_ACCESS[tier].includes(type)) {
    return res.status(403).json({ error: 'Upgrade your tier to access this tool' });
  }
  
  const { data: project, error } = await supabase
    .from('projects')
    .insert([{ user_id: req.user.id, name, type, data: JSON.stringify(data) }])
    .select()
    .single();
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, project });
});

app.put('/api/projects/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { name, data } = req.body;
  
  const { error } = await supabase
    .from('projects')
    .update({ name, data: JSON.stringify(data) })
    .eq('id', id)
    .eq('user_id', req.user.id);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete('/api/projects/:id', auth, async (req, res) => {
  const { id } = req.params;
  
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', req.user.id);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Stripe checkout session
app.post('/api/checkout', auth, async (req, res) => {
  const { tier } = req.body;
  const tierData = PRICING[tier];
  if (!tierData) return res.status(400).json({ error: 'Invalid tier' });
  
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: req.user.email,
    metadata: { tier, userId: req.user.id },
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: `Lights, Camera, Business - ${tierData.name}` },
        unit_amount: tierData.price * 100,
        recurring: { interval: 'month' }
      },
      quantity: 1
    }],
    success_url: `${process.env.APP_URL || 'http://localhost:3000'}/?upgrade=success',
    cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/?upgrade=cancelled`
  });
  
  res.json({ url: session.url });
});

app.listen(PORT, () => {
  console.log(`Lights, Camera, Business running on http://localhost:${PORT}`);
});
