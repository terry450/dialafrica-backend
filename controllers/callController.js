const Call = require("../models/Call");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");

const RATE_PER_MINUTE = 10; // 10 pence per minute

// Validate international phone numbers (E.164)
function isValidInternationalNumber(number) {
  if (typeof number !== "string") return false;

  const trimmed = number.trim();

  // Must start with + and contain 8–15 digits
  const e164Regex = /^\+[1-9]\d{7,14}$/;

  return e164Regex.test(trimmed);
}

exports.estimateCall = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { duration } = req.body;

    if (duration === undefined) {
      return res.status(400).json({
        message: "duration is required"
      });
    }

    const numericDuration = Number(duration);

    if (Number.isNaN(numericDuration) || numericDuration <= 0) {
      return res.status(400).json({
        message: "duration must be greater than 0"
      });
    }

    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return res.status(404).json({
        message: "Wallet not found"
      });
    }

    const cost = numericDuration * RATE_PER_MINUTE;
    const remainingBalance = wallet.balance - cost;
    const affordableMinutes = Math.floor(wallet.balance / RATE_PER_MINUTE);

    res.json({
      ratePerMinute: RATE_PER_MINUTE,
      requestedDuration: numericDuration,
      estimatedCost: cost,
      currentBalance: wallet.balance,
      remainingBalance,
      affordableMinutes,
      canAfford: wallet.balance >= cost
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message
    });
  }
};

exports.getMaxCallTime = async (req, res) => {
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

    const maxMinutes = Math.floor(wallet.balance / RATE_PER_MINUTE);
    const maxSeconds = maxMinutes * 60;

    res.json({
      currentBalance: wallet.balance,
      ratePerMinute: RATE_PER_MINUTE,
      maxMinutes,
      maxSeconds
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message
    });
  }
};

exports.startCall = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { receiverNumber } = req.body;

    if (!receiverNumber) {
      return res.status(400).json({
        message: "receiverNumber is required"
      });
    }

    if (!isValidInternationalNumber(receiverNumber)) {
      return res.status(400).json({
        message:
          "Invalid phone number format. Use international format like +263771234567"
      });
    }

    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return res.status(404).json({
        message: "Wallet not found"
      });
    }

    if (wallet.balance < RATE_PER_MINUTE) {
      return res.status(400).json({
        message: "Not enough balance to start call"
      });
    }

    const existingOngoingCall = await Call.findOne({
      userId,
      status: "ongoing"
    });

    if (existingOngoingCall) {
      return res.status(400).json({
        message: "User already has an ongoing call"
      });
    }

    const maxMinutes = Math.floor(wallet.balance / RATE_PER_MINUTE);
    const maxSeconds = maxMinutes * 60;

    const autoEndTime = new Date(Date.now() + maxSeconds * 1000);

    const call = new Call({
      userId,
      receiverNumber,
      startTime: new Date(),
      status: "ongoing"
    });

    await call.save();

    res.json({
      message: "Call session started",
      ratePerMinute: RATE_PER_MINUTE,
      callId: call._id,
      startTime: call.startTime,
      maxMinutes,
      maxSeconds,
      autoEndTime
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message
    });
  }
};

exports.endCall = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { callId } = req.body;

    if (!callId) {
      return res.status(400).json({
        message: "callId is required"
      });
    }

    const call = await Call.findById(callId);

    if (!call) {
      return res.status(404).json({
        message: "Call not found"
      });
    }

    if (call.userId !== userId) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    if (call.status === "completed") {
      return res.status(400).json({
        message: "Call already completed"
      });
    }

    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return res.status(404).json({
        message: "Wallet not found"
      });
    }

    call.endTime = new Date();

    const durationSeconds = Math.max(
      1,
      Math.floor((call.endTime - call.startTime) / 1000)
    );

    const durationMinutesRounded = Math.ceil(durationSeconds / 60);
    const cost = durationMinutesRounded * RATE_PER_MINUTE;

    if (wallet.balance < cost) {
      return res.status(400).json({
        message: "Insufficient balance to complete call billing"
      });
    }

    wallet.balance -= cost;
    await wallet.save();

    call.durationSeconds = durationSeconds;
    call.durationMinutesRounded = durationMinutesRounded;
    call.cost = cost;
    call.status = "completed";

    await call.save();

    const transaction = new Transaction({
      userId,
      type: "call_charge",
      amount: cost,
      description: "Call charge to " + call.receiverNumber
    });

    await transaction.save();

    res.json({
      message: "Call ended",
      ratePerMinute: RATE_PER_MINUTE,
      durationSeconds,
      durationMinutesRounded,
      cost,
      newBalance: wallet.balance,
      call
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message
    });
  }
};

exports.getCallHistory = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (req.params.userId !== userId) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    const calls = await Call.find({ userId }).sort({
      createdAt: -1
    });

    res.json(calls);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message
    });
  }
};

exports.getRecentCalls = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (req.params.userId !== userId) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    const calls = await Call.find({
      userId,
      status: "completed"
    })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json(calls);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message
    });
  }
};

exports.getCallSummary = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (req.params.userId !== userId) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    const calls = await Call.find({
      userId,
      status: "completed"
    });

    const totalCalls = calls.length;

    const totalMinutes = calls.reduce(
      (sum, call) =>
        sum + (call.durationMinutesRounded || 0),
      0
    );

    const totalSpent = calls.reduce(
      (sum, call) => sum + (call.cost || 0),
      0
    );

    res.json({
      totalCalls,
      totalMinutes,
      totalSpent
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message
    });
  }
};