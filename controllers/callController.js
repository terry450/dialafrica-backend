const Call = require("../models/Call");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const { getRateFromNumber } = require("../config/rates");

// Validate international phone numbers (E.164)
function isValidInternationalNumber(number) {
  if (typeof number !== "string") return false;

  const trimmed = number.trim();
  const e164Regex = /^\+[1-9]\d{7,14}$/;

  return e164Regex.test(trimmed);
}

exports.estimateCall = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { duration, receiverNumber } = req.body;

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

    let ratePerMinute = 10;
    let destinationCountry = "";
    let destinationCode = "";

    if (receiverNumber) {
      if (!isValidInternationalNumber(receiverNumber)) {
        return res.status(400).json({
          message:
            "Invalid phone number format. Use international format like +263771234567"
        });
      }

      const rateInfo = getRateFromNumber(receiverNumber);

      if (!rateInfo) {
        return res.status(400).json({
          message: "Unsupported destination country"
        });
      }

      if (!rateInfo.active) {
        return res.status(400).json({
          message: `${rateInfo.destinationCountry} is currently unavailable`
        });
      }

      ratePerMinute = rateInfo.ratePerMinute;
      destinationCountry = rateInfo.destinationCountry;
      destinationCode = rateInfo.destinationCode;
    }

    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return res.status(404).json({
        message: "Wallet not found"
      });
    }

    const cost = numericDuration * ratePerMinute;
    const remainingBalance = wallet.balance - cost;
    const affordableMinutes = Math.floor(wallet.balance / ratePerMinute);

    res.json({
      destinationCountry,
      destinationCode,
      ratePerMinute,
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

    const defaultRatePerMinute = 10;
    const maxMinutes = Math.floor(wallet.balance / defaultRatePerMinute);
    const maxSeconds = maxMinutes * 60;

    res.json({
      currentBalance: wallet.balance,
      ratePerMinute: defaultRatePerMinute,
      maxMinutes,
      maxSeconds,
      note: "This max time is based on the default rate. Actual time depends on destination country."
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

    const rateInfo = getRateFromNumber(receiverNumber);

    if (!rateInfo) {
      return res.status(400).json({
        message: "Unsupported destination country"
      });
    }

    if (!rateInfo.active) {
      return res.status(400).json({
        message: `${rateInfo.destinationCountry} is currently unavailable`
      });
    }

    const { destinationCountry, destinationCode, ratePerMinute } = rateInfo;

    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return res.status(404).json({
        message: "Wallet not found"
      });
    }

    if (wallet.balance < ratePerMinute) {
      return res.status(400).json({
        message: "Not enough balance to start call"
      });
    }

    const existingLiveCall = await Call.findOne({
      userId,
      status: { $in: ["initiated", "ringing", "connected"] }
    });

    if (existingLiveCall) {
      return res.status(400).json({
        message: "User already has an active call session"
      });
    }

    const maxMinutes = Math.floor(wallet.balance / ratePerMinute);
    const maxSeconds = maxMinutes * 60;
    const autoEndTime = new Date(Date.now() + maxSeconds * 1000);

    const call = new Call({
      userId,
      receiverNumber,
      destinationCountry,
      destinationCode,
      ratePerMinute,
      provider: "simulated",
      startTime: new Date(),
      status: "initiated",
      billingStatus: "pending",
      callDirection: "outbound"
    });

    // Simulated provider progression
    call.status = "connected";
    call.answerTime = new Date();

    await call.save();

    res.json({
      message: "Call session started",
      destinationCountry,
      destinationCode,
      ratePerMinute,
      callId: call._id,
      status: call.status,
      startTime: call.startTime,
      answerTime: call.answerTime,
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

    if (["completed", "failed", "cancelled"].includes(call.status)) {
      return res.status(400).json({
        message: "Call already finished"
      });
    }

    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return res.status(404).json({
        message: "Wallet not found"
      });
    }

    call.endTime = new Date();

    // Important telecom rule:
    // If the call was never answered, do not bill it.
    if (!call.answerTime && ["initiated", "ringing"].includes(call.status)) {
      call.durationSeconds = 0;
      call.durationMinutesRounded = 0;
      call.cost = 0;
      call.status = "cancelled";
      call.billingStatus = "failed";
      call.disconnectReason = "Call never connected";

      await call.save();

      return res.json({
        message: "Unanswered/stuck call closed with no charge",
        destinationCountry: call.destinationCountry,
        destinationCode: call.destinationCode,
        ratePerMinute: call.ratePerMinute || 10,
        status: call.status,
        startTime: call.startTime,
        answerTime: call.answerTime,
        endTime: call.endTime,
        durationSeconds: 0,
        durationMinutesRounded: 0,
        cost: 0,
        newBalance: wallet.balance,
        call
      });
    }

    const billableStartTime = call.answerTime || call.startTime;

    const durationSeconds = Math.max(
      1,
      Math.floor((call.endTime - billableStartTime) / 1000)
    );

    const durationMinutesRounded = Math.ceil(durationSeconds / 60);
    const ratePerMinute = call.ratePerMinute || 10;
    const cost = durationMinutesRounded * ratePerMinute;

    if (wallet.balance < cost) {
      call.status = "failed";
      call.billingStatus = "failed";
      call.disconnectReason = "Insufficient balance to complete call billing";
      await call.save();

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
    call.billingStatus = "billed";
    call.disconnectReason = "Call ended normally";

    await call.save();

    const transaction = new Transaction({
      userId,
      type: "call_charge",
      amount: cost,
      description: `Call charge to ${call.receiverNumber} (${call.destinationCountry})`,
      status: "completed",
      paymentProvider: "",
      paymentReference: ""
    });

    await transaction.save();

    res.json({
      message: "Call ended",
      destinationCountry: call.destinationCountry,
      destinationCode: call.destinationCode,
      ratePerMinute,
      status: call.status,
      startTime: call.startTime,
      answerTime: call.answerTime,
      endTime: call.endTime,
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
      (sum, call) => sum + (call.durationMinutesRounded || 0),
      0
    );
    const totalSpent = calls.reduce(
      (sum, call) => sum + (call.cost || 0),
      0
    );

    const callsByCountry = {};

    for (const call of calls) {
      const country = call.destinationCountry || "Unknown";
      callsByCountry[country] = (callsByCountry[country] || 0) + 1;
    }

    res.json({
      totalCalls,
      totalMinutes,
      totalSpent,
      callsByCountry
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message
    });
  }
};