const express = require("express");
const router = express.Router();

const callController = require("../controllers/callController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.post("/estimate", callController.estimateCall);

router.get("/max-time/:userId", callController.getMaxCallTime);

router.post("/start", callController.startCall);

router.post("/end", callController.endCall);

router.get("/history/:userId", callController.getCallHistory);

router.get("/recent/:userId", callController.getRecentCalls);

router.get("/summary/:userId", callController.getCallSummary);

module.exports = router;