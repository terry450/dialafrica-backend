const Stripe = require("stripe");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount } = req.body;

    const numericAmount = Number(amount);

    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        message: "Valid amount is required"
      });
    }

    if (numericAmount < 50) {
      return res.status(400).json({
        message: "Minimum top-up is 50 pence"
      });
    }

    if (numericAmount > 50000) {
      return res.status(400).json({
        message: "Maximum top-up is 500 pounds"
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "DialAfrica Wallet Top-up"
            },
            unit_amount: numericAmount
          },
          quantity: 1
        }
      ],
      metadata: {
        userId,
        amount: String(numericAmount)
      },
      success_url: "https://dialafrica-backend.onrender.com/payment-success",
      cancel_url: "https://dialafrica-backend.onrender.com/payment-cancel"
    });

    await Transaction.create({
      userId,
      type: "topup",
      amount: numericAmount,
      description: "Stripe payment initiated",
      status: "pending",
      paymentProvider: "stripe",
      paymentReference: session.id
    });

    res.json({
      checkoutUrl: session.url
    });
  } catch (error) {
    console.error("Stripe session error:", error);

    res.status(500).json({
      error: error.message
    });
  }
};

exports.handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log("Webhook signature failed");

    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata.userId;
    const amount = Number(session.metadata.amount);

    try {
      const existingTransaction = await Transaction.findOne({
        paymentReference: session.id
      });

      if (!existingTransaction) {
        console.log("Transaction not found for session:", session.id);
        return res.json({ received: true });
      }

      if (existingTransaction.status === "completed") {
        console.log("Webhook already processed for session:", session.id);
        return res.json({ received: true });
      }

      const wallet = await Wallet.findOne({ userId });

      if (!wallet) {
        console.log("Wallet not found for user:", userId);

        await Transaction.findOneAndUpdate(
          { paymentReference: session.id },
          {
            status: "failed",
            description: "Stripe payment completed but wallet not found"
          }
        );

        return res.status(404).json({ message: "Wallet not found" });
      }

      wallet.balance += amount;
      await wallet.save();

      await Transaction.findOneAndUpdate(
        { paymentReference: session.id },
        {
          status: "completed",
          description: "Stripe payment completed"
        }
      );

      console.log("Wallet credited:", amount);
    } catch (error) {
      console.error("Webhook processing error:", error);
    }
  }

  res.json({
    received: true
  });
};