const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "JWT_SECRET is not configured"
      });
    }

    const authHeader = req.header("Authorization");

    if (!authHeader) {
      return res.status(401).json({
        message: "No token provided"
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Invalid authorization format"
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return res.status(401).json({
        message: "No token provided"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid token"
    });
  }
};