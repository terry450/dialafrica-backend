const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");

exports.createWallet = async (req, res) => {
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
    res.status(500).json({
      error: error.message
    });
  }
};

exports.getWallet = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (req.params.userId !== userId) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return res.status(404).json({
        message: "Wallet not found"
      });
    }

    res.json(wallet);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (req.params.userId !== userId) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    const transactions = await Transaction.find({ userId }).sort({
      createdAt: -1
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};