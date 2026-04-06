const express = require("express");
const router = express.Router();

const Contact = require("../models/Contact");
const contactController = require("../controllers/contactController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

function requireMatchingUserParam(req, res, next) {
  try {
    if (req.params.userId !== req.user.userId) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
}

async function requireContactOwnership(req, res, next) {
  try {
    const contact = await Contact.findById(req.params.contactId);

    if (!contact) {
      return res.status(404).json({
        message: "Contact not found"
      });
    }

    if (contact.userId !== req.user.userId) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    req.contact = contact;
    next();
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
}

router.post("/add", (req, res, next) => {
  req.body.userId = req.user.userId;
  next();
}, contactController.addContact);

router.get("/favorites/:userId", requireMatchingUserParam, contactController.getFavorites);

router.get("/:userId", requireMatchingUserParam, contactController.getContacts);

router.patch("/favorite/:contactId", requireContactOwnership, contactController.toggleFavorite);

router.delete("/:contactId", requireContactOwnership, contactController.deleteContact);

module.exports = router;