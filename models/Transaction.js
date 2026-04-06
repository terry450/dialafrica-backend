const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ["topup", "call_charge"],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    default: ""
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Transaction", transactionSchema);