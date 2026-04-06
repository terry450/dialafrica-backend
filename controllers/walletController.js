const Wallet = require("../models/Wallet");

exports.getWallet = async (req, res) => {
  try {
    const { userId } = req.params;

    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = await Wallet.create({ userId, balance: 0 });
    }

    res.json(wallet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addFunds = async (req, res) => {
  try {
    const { userId, amount } = req.body;

    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = await Wallet.create({ userId, balance: 0 });
    }

    wallet.balance += amount;
    await wallet.save();

    res.json(wallet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};