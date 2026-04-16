require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const callRoutes = require("./routes/callRoutes");
const walletRoutes = require("./routes/walletRoutes");
const contactRoutes = require("./routes/contactRoutes");
const adminRoutes = require("./routes/adminRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const routeRoutes = require("./routes/routeRoutes");
const twilioRoutes = require("./routes/twilioRoutes");

const app = express();
app.set("trust proxy", 1);

if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI is required");
}

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is required");
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error("STRIPE_WEBHOOK_SECRET is required");
}

if (!process.env.TWILIO_ACCOUNT_SID) {
  throw new Error("TWILIO_ACCOUNT_SID is required");
}

if (!process.env.TWILIO_AUTH_TOKEN) {
  throw new Error("TWILIO_AUTH_TOKEN is required");
}

if (!process.env.TWILIO_PHONE_NUMBER) {
  throw new Error("TWILIO_PHONE_NUMBER is required");
}

app.use(cors());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests. Please try again later."
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Try again later."
  }
});

app.use(globalLimiter);

/*
  Stripe webhook routes first
  Twilio webhooks also need raw/form-safe handling before JSON-heavy routes
*/
app.use("/api/payments", paymentRoutes);

/*
  Twilio sends application/x-www-form-urlencoded to webhooks
*/
app.use("/api/twilio", express.urlencoded({ extended: true }), twilioRoutes);

/*
  JSON parser for normal routes
*/
app.use(express.json());

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/routes", routeRoutes);

app.get("/", (req, res) => {
  res.send("DialAfrica API is running");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "DialAfrica API",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get("/payment-success", (req, res) => {
  res.send("Payment successful");
});

app.get("/payment-cancel", (req, res) => {
  res.send("Payment cancelled");
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    message: "Internal server error"
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  }
}

startServer();