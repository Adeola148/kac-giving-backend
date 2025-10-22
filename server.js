cat > server.js <<'EOF'
// server.js (diagnostic)
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();

// Basic diagnostics
const PORT = process.env.PORT || 3000;
const HAS_STRIPE = !!process.env.STRIPE_SECRET_KEY;

console.log('🔧 Booting server...');
console.log('• PORT =', PORT);
console.log('• NODE_ENV =', process.env.NODE_ENV || '(not set)');
console.log('• STRIPE_SECRET_KEY present =', HAS_STRIPE);

// Allow all while testing; restrict later
app.use(cors({ origin: '*' }));
app.use(express.json());

// Safe, lazy Stripe init so startup never crashes if key is missing
let stripe = null;
function getStripe() {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.warn('⚠️  STRIPE_SECRET_KEY missing. /create-checkout will return 500 until it is set.');
    return null;
  }
  stripe = new Stripe(key, { apiVersion: '2024-06-20' });
  return stripe;
}

// Health check + env signal
app.get('/', (_req, res) => {
  res.status(200).send('KAC Giving Backend is running ✅');
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    port: PORT,
    hasStripeKey: HAS_STRIPE,
    node: process.version,
    time: new Date().toISOString(),
  });
});

/**
 * Create Stripe Checkout Session
 * Body: { "type":"tithe"|"offering"|"haggai", "amount":12345, "currency":"gbp" }
 */
app.post('/create-checkout', async (req, res) => {
  try {
    const { type, amount, currency = 'gbp' } = req.body;
    if (!type || !amount) {
      return res.status(400).json({ error: 'Missing type or amount' });
    }

    const stripeClient = getStripe();
    if (!stripeClient) {
      return res.status(500).json({ error: 'Stripe not configured on server (missing STRIPE_SECRET_KEY).' });
    }

    const referenceMap = { tithe: 'TITHE', offering: 'OFFERING', haggai: 'HP2025' };
    const reference = referenceMap[type] || 'UNKNOWN';

    const session = await stripeClient.checkout.sessions.create({
      mode: 'payment',
      currency,
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: `Giving - ${type.toUpperCase()}` },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: { reference, type },
      success_url: 'https://example.com/thanks?status=success',
      cancel_url: 'https://example.com/thanks?status=cancel',
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Checkout error:', err);
    return res.status(500).send('Failed to create checkout session.');
  }
});

// Global error visibility
process.on('unhandledRejection', (e) => console.error('UNHANDLED REJECTION:', e));
process.on('uncaughtException', (e) => console.error('UNCAUGHT EXCEPTION:', e));

// Start (Render sets PORT)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening on ${PORT} (0.0.0.0)`);
});
EOF
