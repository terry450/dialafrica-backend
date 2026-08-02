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

    // ✅ NEW: Phone verification fields
    phoneNumber: {
      type: String,
      default: ""
    },
    verificationCode: {
      type: String,
      default: ""
    },
    codeExpiry: {
      type: Date,
      default: null
    },
    phoneVerified: {
      type: Boolean,
      default: false
    },

    // Existing caller ID fields
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