const express = require("express");

const {
  getRoutes,
  getActiveRoutes,
  getInactiveRoutes
} = require("../controllers/routeController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

/*
  Public route list
*/

router.get("/", getRoutes);

/*
  Admin-only route views
*/

router.get("/active", authMiddleware, getActiveRoutes);

router.get("/inactive", authMiddleware, getInactiveRoutes);

module.exports = router;