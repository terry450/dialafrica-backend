const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const User = require("../models/User");

exports.createPayment = async (req, res) => {
  try {

    const { userId, amount } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: "gbp",
      metadata: { userId }
    });

    res.json({
      clientSecret: paymentIntent.client_secret
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};