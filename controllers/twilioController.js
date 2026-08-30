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
  const staleSetupBefore = new Date(Date.now() - 120 * 1000);
  const staleSetupCalls = await Call.find({
    userId,
    status: { $in: ["initiated", "ringing"] },
    startTime: { $lte: staleSetupBefore }
  });

  for (const call of staleSetupCalls) {
    call.status = "failed";
    call.billingStatus = "failed";
    call.endTime = new Date();
    call.durationSeconds = 0;
    call.durationMinutesRounded = 0;
    call.cost = 0;
    call.disconnectReason = "Stale setup call auto-closed";
    await call.save();
  }

  const staleConnectedBefore = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const staleConnectedCalls = await Call.find({
    userId,
    status: "connected",
    startTime: { $lte: staleConnectedBefore }
  });

  for (const call of staleConnectedCalls) {
    call.status = "failed";
    call.billingStatus = "failed";
    call.endTime = new Date();
    call.disconnectReason = "Abandoned connected call auto-closed";
    await call.save();
  }

  return staleSetupCalls.length + staleConnectedCalls.length;
}

exports.startTwilioCall = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { receiverNumber, callerNumber } = req.body;

    if (!receiverNumber || !callerNumber) {
      return res.status(400).json({ message: "receiverNumber and callerNumber are required" });
    }
    if (!isValidInternationalNumber(receiverNumber)) {
      return res.status(400).json({ message: "receiverNumber must be in international format" });
    }
    if (!isValidInternationalNumber(callerNumber)) {
      return res.status(400).json({ message: "callerNumber must be in international format" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const rateInfo = getRateFromNumber(receiverNumber);
    if (!rateInfo) return res.status(400).json({ message: "Unsupported destination country" });

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) return res.status(404).json({ message: "Wallet not found" });
    if (wallet.balance < rateInfo.ratePerMinute) {
      return res.status(400).json({ message: "Not enough balance to start call" });
    }

    const cleanedUpCount = await cleanupStaleCalls(userId);
    const existingLiveCall = await Call.findOne({
      userId,
      status: { $in: ["initiated", "ringing", "connected"] }
    });
    if (existingLiveCall) {
      return res.status(400).json({ message: "User already has active call" });
    }

    const maxMinutes = Math.floor(wallet.balance / rateInfo.ratePerMinute);
    const maxSeconds = maxMinutes * 60;
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

    const voiceUrl = `https://dialafrica-backend.onrender.com/api/twilio/voice?callId=${call._id}&receiverNumber=${encodeURIComponent(receiverNumber)}&outgoingCallerId=${encodeURIComponent(outgoingCallerId)}&maxSeconds=${maxSeconds}`;

    const twilioCall = await client.calls.create({
      to: callerNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: voiceUrl,
      method: "POST",
      statusCallback: `https://dialafrica-backend.onrender.com/api/twilio/status?callId=${call._id}`,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"]
    });

    call.providerCallId = twilioCall.sid;
    await call.save();

    return res.json({
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
    return res.status(500).json({ error: error.message });
  }
};

exports.voiceWebhook = async (req, res) => {
  try {
    console.log("=================================");
    console.log("VOICE WEBHOOK HIT");
    console.log("QUERY:", req.query);
    console.log("BODY:", req.body);
    console.log("=================================");

    const { callId, receiverNumber, outgoingCallerId, maxSeconds } = req.query;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const call = await Call.findById(callId);
    if (!call) {
      console.log("VOICE WEBHOOK ERROR: Call not found", callId);
      response.say("Call record not found.");
      return res.type("text/xml").send(response.toString());
    }

    const parsedMaxSeconds = Number(maxSeconds || 0);
    const dialOptions = {
      callerId: outgoingCallerId && isValidInternationalNumber(outgoingCallerId)
        ? outgoingCallerId
        : process.env.TWILIO_PHONE_NUMBER
    };
    if (parsedMaxSeconds > 0) {
      dialOptions.timeLimit = parsedMaxSeconds;
    }

    console.log("ATTEMPTING TO DIAL DESTINATION:", receiverNumber);
    console.log("CALLER ID USED:", dialOptions.callerId);

    const dial = response.dial({ ...dialOptions });
    dial.number(
      {
        statusCallback: `https://dialafrica-backend.onrender.com/api/twilio/dial-status?callId=${call._id}`,
        statusCallbackMethod: "POST",
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"]
      },
      receiverNumber
    );

    console.log("TWIML GENERATED:");
    console.log(response.toString());

    return res.type("text/xml").send(response.toString());
  } catch (error) {
    console.error("voiceWebhook error:", error);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say("An error occurred.");
    return res.type("text/xml").send(response.toString());
  }
};

// Main leg status (your phone) – only closes if the dial leg never connected
exports.statusWebhook = async (req, res) => {
  try {
    const { callId } = req.query;
    console.log("=================================");
    console.log("TWILIO STATUS WEBHOOK");
    console.log("CALL ID:", callId);
    console.log("BODY:", req.body);
    console.log("=================================");

    const { CallStatus, CallDuration, DialCallStatus, DialCallSid } = req.body;
    console.log("TWILIO STATUS:", CallStatus);
    console.log("DIAL STATUS:", DialCallStatus);
    console.log("DIAL SID:", DialCallSid);

    if (!callId) return res.status(200).send("ok");

    const call = await Call.findById(callId);
    if (!call) {
      console.log("CALL NOT FOUND:", callId);
      return res.status(200).send("ok");
    }

    // Do NOT set connected or answerTime here – that's handled by dialStatusWebhook
    // when the destination answers.

    // If the main leg ends without the dial leg ever connecting,
    // mark as failed/no-answer if the call is not already completed/connected.
    if (["busy", "failed", "no-answer", "canceled"].includes(CallStatus)) {
      if (call.status !== "completed" && call.status !== "connected") {
        call.status = "failed";
        call.billingStatus = "failed";
        call.endTime = new Date();
        call.durationSeconds = 0;
        call.durationMinutesRounded = 0;
        call.cost = 0;
        call.disconnectReason = CallStatus;
        await call.save();
      }
    }

    // If main leg completes normally but dial leg may have already been handled.
    // We do nothing here because dialStatusWebhook will handle completion/billing.
    // However, if for some reason the dial leg never connected and main leg ends,
    // we should mark as failed.
    if (CallStatus === "completed" && call.status !== "completed") {
      // If call is still initiated/ringing, that means destination never answered.
      if (["initiated", "ringing"].includes(call.status)) {
        call.status = "failed";
        call.billingStatus = "failed";
        call.endTime = new Date();
        call.durationSeconds = 0;
        call.durationMinutesRounded = 0;
        call.cost = 0;
        call.disconnectReason = "Destination never answered";
        await call.save();
      }
    }

    return res.status(200).send("ok");
  } catch (error) {
    console.error("statusWebhook error:", error);
    return res.status(200).send("ok");
  }
};

exports.getCallStatus = async (req, res) => {
  try {
    const { callId } = req.params;
    const call = await Call.findById(callId);
    if (!call) {
      return res.status(404).json({ message: "Call not found" });
    }

    return res.json({
      callId: call._id,
      status: call.status,
      billingStatus: call.billingStatus,
      durationSeconds: call.durationSeconds || 0,
      cost: call.cost || 0,
      receiverNumber: call.receiverNumber,
      destinationCountry: call.destinationCountry,
      disconnectReason: call.disconnectReason || null,
      answerTime: call.answerTime || null,
      startTime: call.startTime || null,
      endTime: call.endTime || null,
      dialStatus: call.dialStatus || null
    });
  } catch (error) {
    console.error("getCallStatus error:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.setVerifiedCallerId = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { verifiedCallerId, callerIdMode } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (verifiedCallerId !== undefined) {
      if (verifiedCallerId !== "" && !isValidInternationalNumber(verifiedCallerId)) {
        return res.status(400).json({ message: "verifiedCallerId invalid" });
      }
      user.verifiedCallerId = verifiedCallerId.trim();
    }
    if (callerIdMode !== undefined) {
      if (!["platform", "user_verified"].includes(callerIdMode)) {
        return res.status(400).json({ message: "Invalid callerIdMode" });
      }
      user.callerIdMode = callerIdMode;
    }
    await user.save();
    return res.json({
      message: "Caller ID settings updated",
      verifiedCallerId: user.verifiedCallerId,
      callerIdMode: user.callerIdMode
    });
  } catch (error) {
    console.error("setVerifiedCallerId error:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.getCallerIdSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({
      verifiedCallerId: user.verifiedCallerId,
      callerIdMode: user.callerIdMode,
      fallbackPlatformNumber: process.env.TWILIO_PHONE_NUMBER
    });
  } catch (error) {
    console.error("getCallerIdSettings error:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.cleanupMyStaleCalls = async (req, res) => {
  try {
    const cleanedUpCount = await cleanupStaleCalls(req.user.userId);
    return res.json({ message: "Cleanup completed", staleCallsClosed: cleanedUpCount });
  } catch (error) {
    console.error("cleanupMyStaleCalls error:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.forceEndActiveCall = async (req, res) => {
  try {
    const userId = req.user.userId;
    const activeCalls = await Call.find({
      userId,
      status: { $in: ["initiated", "ringing", "connected"] }
    });

    for (const call of activeCalls) {
      call.status = "failed";
      call.billingStatus = "failed";
      call.endTime = new Date();
      call.durationSeconds = 0;
      call.durationMinutesRounded = 0;
      call.cost = 0;
      call.disconnectReason = "Force ended by user";
      await call.save();

      if (call.providerCallId) {
        try {
          await client.calls(call.providerCallId).update({ status: "completed" });
        } catch (twilioError) {
          console.error("Twilio force end error:", twilioError.message);
        }
      }
    }

    return res.json({ message: "Active call cleared" });
  } catch (error) {
    console.error("forceEndActiveCall error:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.toggleMute = async (req, res) => {
  try {
    const { callId, mute } = req.body;

    const call = await Call.findById(callId);
    if (!call || !call.providerCallId) {
      return res.status(404).json({ message: "Call not found" });
    }

    await client.calls(call.providerCallId).update({
      twiml: mute
        ? `<Response><Mute/></Response>`
        : `<Response><Unmute/></Response>`
    });

    return res.json({ message: mute ? "Muted" : "Unmuted" });
  } catch (error) {
    console.error("toggleMute error:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.dialStatusWebhook = async (req, res) => {
  try {
    console.log("==============");
    console.log("DIAL STATUS WEBHOOK");
    console.log(req.body);
    console.log("==============");

    const { callId } = req.query;
    if (!callId) return res.status(200).send("ok");

    const call = await Call.findById(callId);
    if (!call) return res.status(200).send("ok");

    const dialStatus = req.body.CallStatus;
    const dialDuration = Number(req.body.CallDuration || 0);
    console.log("DialCallStatus:", dialStatus, "Duration:", dialDuration);

    if (dialStatus) {
      call.dialStatus = dialStatus;
      await call.save();
    }

    // Destination answered: start billing period
    if (dialStatus === "answered") {
      if (!call.answerTime) {
        call.answerTime = new Date();
      }
      call.status = "connected";
      call.billingStatus = "pending";
      await call.save();
    }

    // Destination call ended (hung up or completed)
    if (dialStatus === "completed") {
      call.endTime = new Date();
      call.durationSeconds = dialDuration;
      const roundedMinutes = Math.ceil(dialDuration / 60);
      call.durationMinutesRounded = roundedMinutes;
      const totalCost = roundedMinutes * call.ratePerMinute;
      call.cost = totalCost;

      // Bill the wallet and create transaction if not already billed
      if (call.billingStatus !== "billed") {
        const wallet = await Wallet.findOne({ userId: call.userId });
        if (wallet) {
          wallet.balance = Math.max(0, wallet.balance - totalCost);
          await wallet.save();

          await Transaction.create({
            userId: call.userId,
            type: "call_charge",
            amount: totalCost,
            description: `Call to ${call.receiverNumber}`,
            paymentProvider: "twilio",
            paymentReference: call.providerCallId
          });

          call.billingStatus = "billed";
        }
      }

      call.status = "completed";
      call.disconnectReason = "completed";
      await call.save();
    }

    // Destination failed/ busy / no-answer / canceled
    if (["busy", "failed", "no-answer", "canceled"].includes(dialStatus)) {
      call.status = "failed";
      call.billingStatus = "failed";
      call.endTime = new Date();
      call.durationSeconds = 0;
      call.durationMinutesRounded = 0;
      call.cost = 0;
      call.disconnectReason = dialStatus;
      await call.save();
    }

    return res.status(200).send("ok");
  } catch (error) {
    console.error("dialStatusWebhook error:", error);
    return res.status(200).send("ok");
  }
};