const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/verify-code", authController.verifyCode);   // ✅ NEW
router.post("/resend-code", authController.resendCode);   // ✅ NEW
router.post("/resend-code", authController.resendCode);

module.exports = router;