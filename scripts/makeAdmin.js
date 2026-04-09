require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/User");

async function makeAdmin() {
  try {
    const email = process.argv[2];

    if (!email) {
      throw new Error("Please provide an email. Example: node scripts/makeAdmin.js test@dialafrica.com");
    }

    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is required");
    }

    await mongoose.connect(process.env.MONGO_URI);

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      throw new Error("User not found");
    }

    user.isAdmin = true;
    await user.save();

    console.log(`User ${user.email} is now an admin`);
    process.exit(0);
  } catch (error) {
    console.error("makeAdmin error:", error.message);
    process.exit(1);
  }
}

makeAdmin();