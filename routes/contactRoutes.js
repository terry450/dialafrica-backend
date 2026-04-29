const express = require("express");
const router = express.Router();

const contactController = require("../controllers/contactController");
const authMiddleware = require("../middleware/authMiddleware");

router.post(
  "/add",
  authMiddleware,
  contactController.addContact
);

router.get(
  "/:userId",
  authMiddleware,
  contactController.getContacts
);

router.patch(
  "/favorite/:contactId",
  authMiddleware,
  contactController.toggleFavorite
);

router.delete(
  "/:contactId",
  authMiddleware,
  contactController.deleteContact
);

module.exports = router;