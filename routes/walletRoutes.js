const express = require("express");
const router = express.Router();

const walletController = require("../controllers/walletController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

router.post("/create", authMiddleware, walletController.createWallet);

router.get("/:userId", authMiddleware, walletController.getWallet);

router.get(
  "/transactions/:userId",
  authMiddleware,
  walletController.getTransactions
);

// Admin-only. Normal users must use Stripe checkout.
router.post(
  "/add",
  authMiddleware,
  adminMiddleware,
  walletController.addFunds
);

module.exports = router;