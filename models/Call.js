const mongoose = require("mongoose");

const callSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  receiverNumber: {
    type: String,
    required: true
  },
  startTime: {
    type: Date,
    default: Date.now
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
  },
  status: {
    type: String,
    enum: ["ongoing", "completed"],
    default: "ongoing"
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Call", callSchema);