import User from "../models/User.js";
import Payout from "../models/Payout.js";
import { listNigerianBanks, saveSellerPayoutAccount } from "../services/payoutService.js";

export const getBanks = async (req, res) => {
  try { res.json({ banks: await listNigerianBanks() }); } catch (error) { res.status(502).json({ message: error.message }); }
};

export const savePayoutAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const payoutAccount = await saveSellerPayoutAccount(user, req.body);
    res.json({ message: "Payout account verified and saved", payoutAccount });
  } catch (error) { res.status(400).json({ message: error.message }); }
};

export const getMyPayouts = async (req, res) => {
  const payouts = await Payout.find({ seller: req.user._id }).populate("order", "totalAmount sellerPayoutAmount status").sort({ createdAt: -1 });
  res.json({ payouts });
};
