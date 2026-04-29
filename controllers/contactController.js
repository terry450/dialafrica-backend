const Contact = require("../models/Contact");

// Add contact
exports.addContact = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, phoneNumber } = req.body;

    if (!name || !phoneNumber) {
      return res.status(400).json({
        message: "Name and phoneNumber are required"
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

// Get contacts
exports.getContacts = async (req, res) => {
  try {
    const userId = req.user.userId;

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
    const { contactId } = req.params;

    const contact = await Contact.findById(contactId);

    if (!contact) {
      return res.status(404).json({
        message: "Contact not found"
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
    const { contactId } = req.params;

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