const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");

exports.createWallet = async (req, res) => {
  try {
    const userId = req.user.userId;

    let wallet = await Wallet.findOne({ userId });

    if (wallet) {
      return res.json(wallet);
    }

    wallet = new Wallet({
      userId,
      balance: 0
    });

    await wallet.save();

    res.status(201).json(wallet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getWallet = async (req, res) => {
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
};

exports.getTransactions = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (req.params.userId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const transactions = await Transaction.find({ userId }).sort({
      createdAt: -1
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ADMIN ONLY: manual support/testing top-up
exports.addFunds = async (req, res) => {
  try {
    const { userId, amount } = req.body;
    const numericAmount = Number(amount);

    if (!userId || Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        message: "Valid userId and amount are required"
      });
    }

    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({
        userId,
        balance: 0
      });
    }

    wallet.balance += numericAmount;
    await wallet.save();

    await Transaction.create({
      userId,
      type: "topup",
      amount: numericAmount,
      description: "Manual admin top-up",
      status: "completed",
      paymentProvider: "manual",
      paymentReference: ""
    });

    res.json({
      message: "Funds added successfully",
      userId,
      amountAdded: numericAmount,
      newBalance: wallet.balance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};