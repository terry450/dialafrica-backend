const express = require("express");
const router = express.Router();

const paymentController = require("../controllers/paymentController");
const authMiddleware = require("../middleware/authMiddleware");

/*
 Create Stripe checkout session
 This route needs JSON body parsing
*/
router.post(
  "/create-checkout-session",
  express.json(),
  authMiddleware,
  paymentController.createCheckoutSession
);

/*
 Stripe webhook endpoint
 IMPORTANT: must use raw body
 Do NOT protect with auth
*/
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  paymentController.handleWebhook
);

module.exports = router;