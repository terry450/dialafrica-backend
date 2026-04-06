const Contact = require("../models/Contact");

exports.addContact = async (req, res) => {
  try {
    const { userId, name, phoneNumber } = req.body;

    if (!userId || !name || !phoneNumber) {
      return res.status(400).json({
        message: "userId, name and phoneNumber are required"
      });
    }

    const contact = new Contact({
      userId,
      name,
      phoneNumber
    });

    await contact.save();

    res.json(contact);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

exports.getContacts = async (req, res) => {
  try {
    const { userId } = req.params;

    const contacts = await Contact.find({ userId }).sort({ createdAt: -1 });

    res.json(contacts);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

exports.getFavorites = async (req, res) => {
  try {
    const { userId } = req.params;

    const contacts = await Contact.find({
      userId,
      isFavorite: true
    }).sort({ createdAt: -1 });

    res.json(contacts);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

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

    res.json(contact);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    const { contactId } = req.params;

    await Contact.findByIdAndDelete(contactId);

    res.json({
      message: "Contact deleted"
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};