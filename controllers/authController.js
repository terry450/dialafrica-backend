const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const twilio = require("twilio");
const User = require("../models/User");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Generate a random 6-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

exports.register = async (req, res) => {
  try {
    const { email, password, phoneNumber } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    if (phoneNumber && !/^\+[1-9]\d{7,14}$/.test(phoneNumber.trim())) {
      return res.status(400).json({
        message: "phoneNumber must be in international format like +447123456789"
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const code = phoneNumber ? generateCode() : undefined;

    const user = new User({
      email,
      password: hashedPassword,
      isAdmin: false,
      phoneNumber: phoneNumber || "",
      verificationCode: code || "",
      codeExpiry: code ? new Date(Date.now() + 10 * 60 * 1000) : null
    });

    await user.save();

    // SMS VERIFICATION
    if (phoneNumber && code) {
      try {
        await client.messages.create({
          body: `Your DialAfrica verification code is: ${code}`,
          to: phoneNumber,
          from: process.env.TWILIO_PHONE_NUMBER
        });
        console.log(`Verification SMS sent to ${phoneNumber}`);
      } catch (smsError) {
        console.error("Failed to send verification SMS:", smsError);
      }
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User registered",
      token,
      userId: user._id,
      isAdmin: user.isAdmin,
      phoneNumber: user.phoneNumber || null,
      phoneVerified: user.phoneVerified,
      requiresVerification: !!phoneNumber,
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.verifyCode = async (req, res) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({ message: "userId and code are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.phoneVerified) {
      return res.status(400).json({ message: "Phone already verified" });
    }

    if (user.codeExpiry && new Date() > user.codeExpiry) {
      return res.status(400).json({ message: "Verification code expired. Request a new one." });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: "Invalid code" });
    }

    user.phoneVerified = true;
    user.verifiedCallerId = user.phoneNumber;
    user.callerIdMode = "user_verified";
    user.verificationCode = "";
    user.codeExpiry = null;
    await user.save();

    res.json({
      message: "Phone verified successfully",
      phoneNumber: user.phoneNumber,
      verifiedCallerId: user.verifiedCallerId,
      callerIdMode: user.callerIdMode,
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.resendCode = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.phoneVerified) {
      return res.status(400).json({ message: "Phone already verified" });
    }

    if (!user.phoneNumber) {
      return res.status(400).json({ message: "No phone number on file" });
    }

    const code = generateCode();
    user.verificationCode = code;
    user.codeExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    try {
      await client.messages.create({
        body: `Your DialAfrica verification code is: ${code}`,
        to: user.phoneNumber,
        from: process.env.TWILIO_PHONE_NUMBER
      });
      console.log(`Resent verification SMS to ${user.phoneNumber}`);
    } catch (smsError) {
      console.error("Failed to resend verification SMS:", smsError);
      return res.status(500).json({ message: "Failed to send SMS. Please try again." });
    }

    res.json({ message: "New code sent via SMS" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      userId: user._id,
      isAdmin: user.isAdmin,
      phoneNumber: user.phoneNumber || null,
      phoneVerified: user.phoneVerified,
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};