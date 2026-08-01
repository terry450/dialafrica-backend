const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  startTwilioCall,
  voiceWebhook,
  statusWebhook,
  dialStatusWebhook,
  setVerifiedCallerId,
  getCallerIdSettings,
  cleanupMyStaleCalls,
  getCallStatus,
  forceEndActiveCall,
  toggleMute          // ✅ ADD THIS
} = require("../controllers/twilioController");

// User starts a real Twilio-backed call
router.post(
  "/start",
  express.json(),
  authMiddleware,
  startTwilioCall
);

router.post(
  "/dial-status",
  dialStatusWebhook
);

// Real-time polling endpoint
router.get(
  "/status/:callId",
  authMiddleware,
  getCallStatus
);

// User caller ID settings
router.get(
  "/caller-id",
  authMiddleware,
  getCallerIdSettings
);

router.patch(
  "/caller-id",
  express.json(),
  authMiddleware,
  setVerifiedCallerId
);

// Manual stale call cleanup
router.post(
  "/cleanup-stale",
  authMiddleware,
  cleanupMyStaleCalls
);

router.post(
  "/force-end",
  authMiddleware,
  forceEndActiveCall
);

// ✅ NEW: Mute / unmute a live call
router.post(
  "/mute",
  express.json(),
  authMiddleware,
  toggleMute
);

// Twilio voice webhook
router.post(
  "/voice",
  voiceWebhook
);

// Twilio status webhook
router.post(
  "/status",
  statusWebhook
);

module.exports = router;