const express = require("express");
const router = express.Router();

const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

// Create wallet
router.post("/create", async (req, res) => {
  try {
    const userId = req.user.userId;

    const existingWallet = await Wallet.findOne({ userId });

    if (existingWallet) {
      return res.status(200).json(existingWallet);
    }

    const wallet = new Wallet({
      userId,
      balance: 0
    });

    await wallet.save();

    res.status(201).json(wallet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get wallet
router.get("/:userId", async (req, res) => {
  try {
    const userId = req.user.userId;

    if (req.params.userId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    res.json(wallet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add money
router.post("/add", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount } = req.body;

    if (amount === undefined) {
      return res.status(400).json({ message: "amount is required" });
    }

    const numericAmount = Number(amount);

    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: "amount must be greater than 0" });
    }

    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    wallet.balance += numericAmount;
    await wallet.save();

    const transaction = new Transaction({
      userId,
      type: "topup",
      amount: numericAmount,
      description: "Wallet top-up"
    });

    await transaction.save();

    res.json(wallet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get transaction history
router.get("/transactions/:userId", async (req, res) => {
  try {
    const userId = req.user.userId;

    if (req.params.userId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const transactions = await Transaction.find({ userId }).sort({ createdAt: -1 });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;