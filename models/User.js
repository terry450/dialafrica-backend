const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    isAdmin: {
      type: Boolean,
      default: false
    },
    verifiedCallerId: {
      type: String,
      default: ""
    },
    callerIdMode: {
      type: String,
      enum: ["platform", "user_verified"],
      default: "platform"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);