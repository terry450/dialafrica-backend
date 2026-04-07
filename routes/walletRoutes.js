const express = require("express");
const router = express.Router();

const walletController = require("../controllers/walletController");
const authMiddleware = require("../middleware/authMiddleware");

/*
 Get wallet balance
*/
router.get(
  "/:userId",
  authMiddleware,
  walletController.getWallet
);

/*
 Get wallet transactions
*/
router.get(
  "/transactions/:userId",
  authMiddleware,
  walletController.getTransactions
);

/*
 Create wallet
*/
router.post(
  "/create",
  authMiddleware,
  walletController.createWallet
);

/*
 IMPORTANT:
 Manual wallet add-money route removed.
 All top-ups must go through Stripe webhook.
*/

module.exports = router;