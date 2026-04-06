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

const app = express();

if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI is required");
}

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

app.use(cors());
app.use(express.json());

/*
  Global rate limiter
  Limits each IP to 100 requests per 15 minutes
*/
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests. Please try again later."
  }
});

app.use(globalLimiter);

/*
  Stricter limiter for authentication routes
  Prevents brute-force login attempts
*/
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Try again later."
  }
});

app.use("/api/auth", authLimiter, authRoutes);

app.use("/api/calls", callRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/admin", adminRoutes);

app.get("/", (req, res) => {
  res.send("DialAfrica API is running");
});

/*
  Central error handler
*/
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