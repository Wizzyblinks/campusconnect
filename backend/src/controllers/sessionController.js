import User from "../models/User.js";

export const logoutSession = async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $inc: { tokenVersion: 1 } },
    );
    return res.json({ message: "You have been logged out." });
  } catch (error) {
    console.error("Logout session revocation failed:", error.message);
    return res.status(500).json({ message: "We couldn't securely end your session." });
  }
};
