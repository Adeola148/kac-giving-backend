// server.js
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();

// ✅ Allow all origins while testing (you can restrict later)
app.use(cors({ origin: '*' }));
app.use(express.json());

// ⚠️ IMPORTANT: Set STRIPE_SECRET_KEY in Render (Environment Variables). Never hardcode it.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// 🩺 Health check route (to confirm server is running)
app.get('/', (req, res) => {
  res.send('KAC Giving Backend is running ✅');
});

/**
 * 💳 Create Stripe Checkout Session
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

    // 🆔 Map to hidden reference codes
    const referenceMap = {
      tithe: 'TITHE',
      offering: 'OFFERING',
      haggai: 'HP2025',
    };
    const reference = referenceMap[type] || 'UNKNOWN';

    // 🧾 Create checkout session
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
      metadata: {
        reference,
        type,
      },
      success_url: 'https://example.com/thanks?status=success',
      cancel_url: 'https://example.com/thanks?status=cancel',
    });

    // Return Stripe Checkout URL
    return res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return res.status(500).send('Failed to create checkout session.');
  }
});

// 🚀 Start server (Render provides PORT automatically)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
