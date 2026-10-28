import jwt from "jsonwebtoken";
import User from "../models/User.js";

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    const tokenVersion = decoded.tokenVersion ?? 0;

    if ((user.tokenVersion || 0) !== tokenVersion) {
      return res.status(401).json({
        message: "Session expired. Please log in again.",
      });
    }

    if (user.emailVerified === false) {
      return res.status(403).json({
        message: "Email verification is required before accessing this account.",
      });
    }

    if (user.isRestricted) {
      return res.status(403).json({
        message: "Account restricted",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

export default protect;
