import { getSellerEligibility } from "../services/sellerEligibility.js";

export const createRequireSeller = (eligibilityLookup) => async (req, res, next) => {
  try {
    const eligibility = await eligibilityLookup(req.user._id);
    if (!eligibility.eligible) {
      const message = eligibility.application?.status === "PENDING"
        ? "Your seller application is awaiting review."
        : eligibility.application?.status === "SUSPENDED"
          ? "Seller access is currently suspended."
          : eligibility.application?.status === "REJECTED"
            ? "Seller access is unavailable. You may submit a new application."
            : "An approved seller application is required.";
      return res.status(403).json({
        code: "SELLER_APPROVAL_REQUIRED",
        message,
        applicationStatus: eligibility.application?.status || null,
      });
    }

    req.sellerEligibility = eligibility;
    return next();
  } catch (error) {
    console.error("Seller eligibility check failed:", error.message);
    return res.status(500).json({ message: "Could not verify seller access." });
  }
};

const requireSeller = createRequireSeller(getSellerEligibility);

export default requireSeller;
