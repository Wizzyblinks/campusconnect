import MarketplaceListing from "../models/MarketplaceListing.js";
import Order from "../models/Order.js";
import SellerApplication from "../models/SellerApplication.js";

export const createSellerEligibilityLookup = ({
  sellerApplications,
  marketplaceListings,
  orders,
}) => async (userId) => {
  const application = await sellerApplications.findOne({ seller: userId })
    .select("status businessName categories description reviewNote createdAt reviewedAt")
    .lean();

  if (application) {
    return {
      eligible: application.status === "APPROVED",
      legacySeller: false,
      application,
    };
  }

  const [hasListingHistory, hasOrderHistory] = await Promise.all([
    marketplaceListings.exists({ seller: userId }),
    orders.exists({ seller: userId }),
  ]);
  const legacySeller = Boolean(hasListingHistory || hasOrderHistory);
  return {
    eligible: legacySeller,
    legacySeller,
    application: null,
  };
};

export const getSellerEligibility = createSellerEligibilityLookup({
  sellerApplications: SellerApplication,
  marketplaceListings: MarketplaceListing,
  orders: Order,
});
