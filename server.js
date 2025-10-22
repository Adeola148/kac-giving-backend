// server.js
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();

// 🔒 Allow only your app or testing origins if you like (keep "*" while testing)
app.use(cors({ origin: '*'}));
app.use(express.json());

// ⚠️ Set STRIPE_SECRET_KEY in Render (Environment Variables). Never hardcode here.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// (Optional) Quick health check
app.get('/', (req, res) => {
  res.send('KAC Giving Backend is running ✅');
});

/**
 * Create Stripe Checkout Session
 * Body:
 *  {
 *    "type": "tithe" | "offering" | "haggai",
 *    "amount": 12345,       // amount in pence (e.g., £123.45 => 12345)
 *    "currency": "gbp"      // default "gbp"
 *  }
 */
app.post('/create-checkout', async (req, res) => {
  try {
    const { type, amount, currency = 'gbp' } = req.body;
    if (!type || !amount) {
      return res.status(400).json({ error: 'Missing type or amount' });
    }
    // Map to hidden reference codes
    const referenceMap = { tithe: 'TITHE', offering: 'OFFERING', haggai: 'HP2025' };
    const reference = referenceMap[type] || 'UNKNOWN';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency,
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: `Giving - ${type.toUpperCase()}` },
            unit_amount: amount, // pence
          },
          quantity: 1,
        },
      ],
      // 👇 Hidden metadata only you see in Stripe
      metadata: {
        reference,
        type,
      },
      // 👇 Change these later to your real website (optional)
      success_url: 'https://example.com/thanks?status=success',
      cancel_url: 'https://example.com/thanks?status=cancel',
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return res.status(500).send('Failed to create checkout session.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server listening on ${PORT}`));
