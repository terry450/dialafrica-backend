const User = require("../models/User");

module.exports = async function (req, res, next) {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(401).json({
        message: "User not found"
      });
    }

    if (!user.isAdmin) {
      return res.status(403).json({
        message: "Admin access required"
      });
    }

    req.admin = user;
    next();
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};