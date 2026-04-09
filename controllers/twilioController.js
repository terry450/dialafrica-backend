const twilio = require("twilio");
const Call = require("../models/Call");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const { getRateFromNumber } = require("../config/rates");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

function isValidInternationalNumber(number) {
  if (typeof number !== "string") return false;
  return /^\+[1-9]\d{7,14}$/.test(number.trim());
}

function getOutgoingCallerId(user) {
  if (
    user &&
    user.callerIdMode === "user_verified" &&
    user.verifiedCallerId &&
    isValidInternationalNumber(user.verifiedCallerId)
  ) {
    return user.verifiedCallerId;
  }

  return process.env.TWILIO_PHONE_NUMBER;
}

async function cleanupStaleCalls(userId) {
  const staleStatuses = ["initiated", "ringing"];
  const staleBefore = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes

  const staleCalls = await Call.find({
    userId,
    status: { $in: staleStatuses },
    startTime: { $lte: staleBefore }
  });

  for (const call of staleCalls) {
    call.status = "failed";
    call.billingStatus = "failed";
    call.endTime = new Date();
    call.durationSeconds = 0;
    call.durationMinutesRounded = 0;
    call.cost = 0;
    call.disconnectReason = "Stale call auto-closed";
    await call.save();
  }

  return staleCalls.length;
}

exports.startTwilioCall = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { receiverNumber, callerNumber } = req.body;

    if (!receiverNumber || !callerNumber) {
      return res.status(400).json({
        message: "receiverNumber and callerNumber are required"
      });
    }

    if (!isValidInternationalNumber(receiverNumber)) {
      return res.status(400).json({
        message:
          "receiverNumber must be in international format like +263771234567"
      });
    }

    if (!isValidInternationalNumber(callerNumber)) {
      return res.status(400).json({
        message:
          "callerNumber must be in international format like +447123456789"
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
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

    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return res.status(404).json({
        message: "Wallet not found"
      });
    }

    if (wallet.balance < rateInfo.ratePerMinute) {
      return res.status(400).json({
        message: "Not enough balance to start call"
      });
    }

    const cleanedUpCount = await cleanupStaleCalls(userId);

    const existingLiveCall = await Call.findOne({
      userId,
      status: { $in: ["initiated", "ringing", "connected"] }
    });

    if (existingLiveCall) {
      return res.status(400).json({
        message: "User already has an active call session"
      });
    }

    const maxMinutes = Math.floor(wallet.balance / rateInfo.ratePerMinute);
    const maxSeconds = maxMinutes * 60;

    if (maxSeconds <= 0) {
      return res.status(400).json({
        message: "Not enough balance to place this call"
      });
    }

    const outgoingCallerId = getOutgoingCallerId(user);

    const call = new Call({
      userId,
      receiverNumber,
      destinationCountry: rateInfo.destinationCountry,
      destinationCode: rateInfo.destinationCode,
      ratePerMinute: rateInfo.ratePerMinute,
      provider: "twilio",
      status: "initiated",
      billingStatus: "pending",
      callDirection: "outbound"
    });

    await call.save();

    const twilioCall = await client.calls.create({
      to: callerNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: `https://dialafrica-backend.onrender.com/api/twilio/voice?callId=${call._id}&receiverNumber=${encodeURIComponent(
        receiverNumber
      )}&outgoingCallerId=${encodeURIComponent(
        outgoingCallerId
      )}&maxSeconds=${maxSeconds}`,
      method: "POST",
      statusCallback: `https://dialafrica-backend.onrender.com/api/twilio/status?callId=${call._id}`,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"]
    });

    call.providerCallId = twilioCall.sid;
    await call.save();

    res.json({
      message: "Twilio call initiated",
      callId: call._id,
      providerCallId: twilioCall.sid,
      provider: "twilio",
      status: call.status,
      destinationCountry: call.destinationCountry,
      ratePerMinute: call.ratePerMinute,
      outgoingCallerIdUsed: outgoingCallerId,
      maxMinutes,
      maxSeconds,
      staleCallsClosed: cleanedUpCount
    });
  } catch (error) {
    console.error("startTwilioCall error:", error);

    res.status(500).json({
      error: error.message
    });
  }
};

exports.voiceWebhook = async (req, res) => {
  try {
    const { callId, receiverNumber, outgoingCallerId, maxSeconds } = req.query;

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    if (!callId || !receiverNumber) {
      response.say("Call configuration error.");
      return res.type("text/xml").send(response.toString());
    }

    const call = await Call.findById(callId);

    if (!call) {
      response.say("Call record not found.");
      return res.type("text/xml").send(response.toString());
    }

    call.status = "connected";
    if (!call.answerTime) {
      call.answerTime = new Date();
    }
    await call.save();

    const parsedMaxSeconds = Number(maxSeconds || 0);

    const dialOptions = {
      callerId:
        outgoingCallerId && isValidInternationalNumber(outgoingCallerId)
          ? outgoingCallerId
          : process.env.TWILIO_PHONE_NUMBER
    };

    if (!Number.isNaN(parsedMaxSeconds) && parsedMaxSeconds > 0) {
      dialOptions.timeLimit = parsedMaxSeconds;
    }

    const dial = response.dial(dialOptions);
    dial.number(receiverNumber);

    return res.type("text/xml").send(response.toString());
  } catch (error) {
    console.error("voiceWebhook error:", error);

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say("An error occurred.");
    return res.type("text/xml").send(response.toString());
  }
};

exports.statusWebhook = async (req, res) => {
  try {
    const { callId } = req.query;
    const { CallStatus, CallDuration } = req.body;

    if (!callId) {
      return res.status(200).send("ok");
    }

    const call = await Call.findById(callId);

    if (!call) {
      return res.status(200).send("ok");
    }

    if (CallStatus === "ringing") {
      call.status = "ringing";
      await call.save();
      return res.status(200).send("ok");
    }

    if (CallStatus === "in-progress") {
      call.status = "connected";
      if (!call.answerTime) {
        call.answerTime = new Date();
      }
      await call.save();
      return res.status(200).send("ok");
    }

    if (["completed", "busy", "no-answer", "failed", "canceled"].includes(CallStatus)) {
      const wallet = await Wallet.findOne({ userId: call.userId });

      call.endTime = new Date();

      if (!call.answerTime && ["busy", "no-answer", "failed", "canceled"].includes(CallStatus)) {
        call.status = "failed";
        call.billingStatus = "failed";
        call.durationSeconds = 0;
        call.durationMinutesRounded = 0;
        call.cost = 0;
        call.disconnectReason = `Twilio status: ${CallStatus}`;
        await call.save();
        return res.status(200).send("ok");
      }

      if (!wallet) {
        call.status = "failed";
        call.billingStatus = "failed";
        call.disconnectReason = "Wallet not found";
        await call.save();
        return res.status(200).send("ok");
      }

      const durationSeconds = Math.max(0, Number(CallDuration || 0));
      const durationMinutesRounded = Math.ceil(durationSeconds / 60);
      const ratePerMinute = call.ratePerMinute || 10;
      const cost = durationMinutesRounded * ratePerMinute;

      call.durationSeconds = durationSeconds;
      call.durationMinutesRounded = durationMinutesRounded;
      call.cost = cost;

      if (CallStatus === "completed") {
        if (wallet.balance < cost) {
          call.status = "failed";
          call.billingStatus = "failed";
          call.disconnectReason = "Insufficient balance to bill completed call";
          await call.save();
          return res.status(200).send("ok");
        }

        wallet.balance -= cost;
        await wallet.save();

        call.status = "completed";
        call.billingStatus = "billed";
        call.disconnectReason = "Call ended normally";

        await Transaction.create({
          userId: call.userId,
          type: "call_charge",
          amount: cost,
          description: `Twilio call charge to ${call.receiverNumber} (${call.destinationCountry})`,
          status: "completed",
          paymentProvider: "twilio",
          paymentReference: call.providerCallId || ""
        });
      } else {
        call.status = "failed";
        call.billingStatus = "failed";
        call.disconnectReason = `Twilio status: ${CallStatus}`;
      }

      await call.save();
    }

    return res.status(200).send("ok");
  } catch (error) {
    console.error("statusWebhook error:", error);
    return res.status(200).send("ok");
  }
};

exports.setVerifiedCallerId = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { verifiedCallerId, callerIdMode } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (verifiedCallerId !== undefined) {
      if (
        verifiedCallerId !== "" &&
        !isValidInternationalNumber(verifiedCallerId)
      ) {
        return res.status(400).json({
          message:
            "verifiedCallerId must be in international format like +447123456789"
        });
      }

      user.verifiedCallerId = verifiedCallerId.trim();
    }

    if (callerIdMode !== undefined) {
      if (!["platform", "user_verified"].includes(callerIdMode)) {
        return res.status(400).json({
          message: "callerIdMode must be either platform or user_verified"
        });
      }

      user.callerIdMode = callerIdMode;
    }

    await user.save();

    res.json({
      message: "Caller ID settings updated",
      verifiedCallerId: user.verifiedCallerId,
      callerIdMode: user.callerIdMode
    });
  } catch (error) {
    console.error("setVerifiedCallerId error:", error);

    res.status(500).json({
      error: error.message
    });
  }
};

exports.getCallerIdSettings = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.json({
      verifiedCallerId: user.verifiedCallerId,
      callerIdMode: user.callerIdMode,
      fallbackPlatformNumber: process.env.TWILIO_PHONE_NUMBER
    });
  } catch (error) {
    console.error("getCallerIdSettings error:", error);

    res.status(500).json({
      error: error.message
    });
  }
};

exports.cleanupMyStaleCalls = async (req, res) => {
  try {
    const userId = req.user.userId;
    const cleanedUpCount = await cleanupStaleCalls(userId);

    res.json({
      message: "Stale calls cleanup completed",
      staleCallsClosed: cleanedUpCount
    });
  } catch (error) {
    console.error("cleanupMyStaleCalls error:", error);

    res.status(500).json({
      error: error.message
    });
  }
};