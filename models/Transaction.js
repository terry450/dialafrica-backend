const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
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
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed"
    },
    paymentProvider: {
      type: String,
      enum: ["stripe", "system", ""],
      default: ""
    },
    paymentReference: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Transaction", transactionSchema);