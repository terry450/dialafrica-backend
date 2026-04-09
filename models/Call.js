const mongoose = require("mongoose");

const callSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true
    },
    receiverNumber: {
      type: String,
      required: true
    },
    destinationCountry: {
      type: String,
      default: ""
    },
    destinationCode: {
      type: String,
      default: ""
    },
    ratePerMinute: {
      type: Number,
      default: 10
    },
    provider: {
      type: String,
      default: ""
    },
    providerCallId: {
      type: String,
      default: ""
    },
    disconnectReason: {
      type: String,
      default: ""
    },
    billingStatus: {
      type: String,
      enum: ["pending", "billed", "failed"],
      default: "pending"
    },
    callDirection: {
      type: String,
      enum: ["outbound"],
      default: "outbound"
    },
    status: {
      type: String,
      enum: [
        "initiated",
        "ringing",
        "connected",
        "completed",
        "failed",
        "cancelled"
      ],
      default: "initiated"
    },
    startTime: {
      type: Date,
      default: Date.now
    },
    answerTime: {
      type: Date,
      default: null
    },
    endTime: {
      type: Date,
      default: null
    },
    durationSeconds: {
      type: Number,
      default: 0
    },
    durationMinutesRounded: {
      type: Number,
      default: 0
    },
    cost: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Call", callSchema);