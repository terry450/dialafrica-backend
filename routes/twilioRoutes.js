const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  startTwilioCall,
  voiceWebhook,
  statusWebhook,
  setVerifiedCallerId,
  getCallerIdSettings,
  cleanupMyStaleCalls
} = require("../controllers/twilioController");

// User starts a real Twilio-backed call
router.post(
  "/start",
  express.json(),
  authMiddleware,
  startTwilioCall
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

// Manual stale call cleanup for the logged-in user
router.post(
  "/cleanup-stale",
  authMiddleware,
  cleanupMyStaleCalls
);

// Twilio hits this to get call instructions (TwiML)
router.post("/voice", voiceWebhook);

// Twilio hits this with call status updates
router.post("/status", statusWebhook);

module.exports = router;