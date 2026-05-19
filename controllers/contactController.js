const Contact = require("../models/Contact");

// Add single contact
exports.addContact = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, phoneNumber } = req.body;

    if (!name || !phoneNumber) {
      return res.status(400).json({
        message: "Name and phoneNumber are required"
      });
    }

    const existingContact = await Contact.findOne({
      userId,
      phoneNumber
    });

    if (existingContact) {
      return res.status(400).json({
        message: "Contact already exists"
      });
    }

    const contact = new Contact({
      userId,
      name,
      phoneNumber
    });

    await contact.save();

    res.status(201).json({
      message: "Contact added",
      contact
    });

  } catch (err) {
    console.error("Add contact error:", err);

    res.status(500).json({
      message: "Failed to add contact"
    });
  }
};

// Sync device contacts
exports.syncContacts = async (req, res) => {
  try {
    const authenticatedUserId = req.user.userId;

    const { userId, contacts } = req.body;

    // Security check
    if (userId !== authenticatedUserId) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    if (!Array.isArray(contacts)) {
      return res.status(400).json({
        message: "contacts must be an array"
      });
    }

    let addedCount = 0;

    for (const item of contacts) {

      if (!item.phoneNumber) {
        continue;
      }

      const existingContact = await Contact.findOne({
        userId,
        phoneNumber: item.phoneNumber
      });

      if (existingContact) {

        // Update name if changed
        if (
          item.name &&
          existingContact.name !== item.name
        ) {
          existingContact.name = item.name;
          await existingContact.save();
        }

        continue;
      }

      await Contact.create({
        userId,
        name: item.name || "Unknown",
        phoneNumber: item.phoneNumber
      });

      addedCount++;
    }

    res.json({
      message: `Synced ${addedCount} contacts`,
      addedCount
    });

  } catch (err) {
    console.error("Sync contacts error:", err);

    res.status(500).json({
      message: "Failed to sync contacts"
    });
  }
};

// Get contacts
exports.getContacts = async (req, res) => {
  try {
    const authenticatedUserId = req.user.userId;
    const { userId } = req.params;

    // Security check
    if (authenticatedUserId !== userId) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    const contacts = await Contact.find({
      userId
    }).sort({
      createdAt: -1
    });

    res.json(contacts);

  } catch (err) {
    console.error("Get contacts error:", err);

    res.status(500).json({
      message: "Failed to fetch contacts"
    });
  }
};

// Toggle favorite
exports.toggleFavorite = async (req, res) => {
  try {
    const authenticatedUserId = req.user.userId;
    const { contactId } = req.params;

    const contact = await Contact.findById(contactId);

    if (!contact) {
      return res.status(404).json({
        message: "Contact not found"
      });
    }

    // Security check
    if (contact.userId !== authenticatedUserId) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    contact.isFavorite = !contact.isFavorite;

    await contact.save();

    res.json({
      message: "Favorite updated",
      contact
    });

  } catch (err) {
    console.error("Toggle favorite error:", err);

    res.status(500).json({
      message: "Failed to update favorite"
    });
  }
};

// Delete contact
exports.deleteContact = async (req, res) => {
  try {
    const authenticatedUserId = req.user.userId;
    const { contactId } = req.params;

    const contact = await Contact.findById(contactId);

    if (!contact) {
      return res.status(404).json({
        message: "Contact not found"
      });
    }

    // Security check
    if (contact.userId !== authenticatedUserId) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    await Contact.findByIdAndDelete(contactId);

    res.json({
      message: "Contact deleted"
    });

  } catch (err) {
    console.error("Delete contact error:", err);

    res.status(500).json({
      message: "Failed to delete contact"
    });
  }
};