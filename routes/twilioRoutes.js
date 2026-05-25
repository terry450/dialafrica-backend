const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  startTwilioCall,
  voiceWebhook,
  statusWebhook,
  setVerifiedCallerId,
  getCallerIdSettings,
  cleanupMyStaleCalls,
  getCallStatus
} = require("../controllers/twilioController");

// User starts a real Twilio-backed call
router.post(
  "/start",
  express.json(),
  authMiddleware,
  startTwilioCall
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