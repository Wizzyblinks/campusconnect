import MarketplaceListing from "../models/MarketplaceListing.js";
import cloudinary, { isCloudinaryConfigured } from "../config/cloudinary.js";

const listingCategories = [
  "electronics",
  "fashion",
  "books",
  "food",
  "services",
  "school_items",
  "others",
];
const listingConditions = ["new", "used", "fair"];

const normalizeImageUrls = (images) => {
  const urls =
    images === undefined || images === null || images === ""
      ? []
      : Array.isArray(images)
        ? images
        : [images];

  if (
    urls.some((image) => {
      if (typeof image !== "string") {
        return true;
      }

      try {
        const url = new URL(image.trim());
        return !["http:", "https:"].includes(url.protocol);
      } catch {
        return true;
      }
    })
  ) {
    return null;
  }

  return urls.map((image) => new URL(image.trim()).toString());
};

const uploadMedia = (file) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "campus-connect/marketplace",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result?.secure_url || !result?.public_id) {
          reject(new Error("Cloudinary did not return a stored media URL"));
          return;
        }

        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
          resourceType: "image",
        });
      },
    );

    stream.end(file.buffer);
  });
};

const removeUploadedMedia = async (assets) => {
  const results = await Promise.allSettled(
    assets.map((asset) =>
      Promise.resolve().then(() =>
        cloudinary.uploader.destroy(asset.publicId, {
          resource_type: asset.resourceType,
        }),
      ),
    ),
  );

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error(
        "Failed to remove temporary Cloudinary marketplace media:",
        result.reason?.message || "Unknown Cloudinary error",
      );
    }
  });
};

export const createListing = async (req, res) => {
  const uploadedAssets = [];

  try {
    const {
      title,
      description,
      price,
      category,
      images,
      condition,
      stock,
      sellerTermsAccepted,
    } = req.body;

    const normalizedTitle = typeof title === "string" ? title.trim() : "";
    const normalizedDescription =
      typeof description === "string" ? description.trim() : "";
    const parsedPrice = Number(price);
    const parsedStock = stock === undefined ? 1 : Number(stock);
    const normalizedImages = normalizeImageUrls(images);

    if (
      !normalizedTitle ||
      normalizedTitle.length > 120 ||
      !normalizedDescription ||
      normalizedDescription.length > 1000 ||
      price === undefined ||
      price === null ||
      price === "" ||
      !["string", "number"].includes(typeof price) ||
      !Number.isFinite(parsedPrice) ||
      parsedPrice < 0 ||
      !listingCategories.includes(category)
    ) {
      return res.status(400).json({
        message:
          "Provide a title (up to 120 characters), description (up to 1000 characters), valid non-negative price, and valid category",
      });
    }

    if (
      !Number.isInteger(parsedStock) ||
      parsedStock < 1 ||
      (condition !== undefined && !listingConditions.includes(condition))
    ) {
      return res.status(400).json({
        message: "Provide a valid condition and a whole-number stock of at least 1",
      });
    }

    if (normalizedImages === null) {
      return res.status(400).json({
        message: "Listing image URLs must be valid HTTP or HTTPS URLs",
      });
    }

    if (
      !req.user.sellerTermsAcceptedAt &&
      sellerTermsAccepted !== "true" &&
      sellerTermsAccepted !== true
    ) {
      return res.status(400).json({
        message:
          "You must accept the seller terms before publishing your first listing",
      });
    }

    const files = req.files || [];
    if (files.length > 0 && !isCloudinaryConfigured()) {
      return res.status(503).json({
        message:
          "Marketplace image storage is not configured. Please contact support.",
      });
    }

    if (files.some((file) => !Buffer.isBuffer(file.buffer))) {
      return res.status(400).json({
        message: "Marketplace media could not be read. Please re-upload it.",
      });
    }

    try {
      for (const file of files) {
        uploadedAssets.push(await uploadMedia(file));
      }
    } catch (error) {
      await removeUploadedMedia(uploadedAssets);
      uploadedAssets.length = 0;
      console.error("Marketplace media upload failed:", error.message);
      return res.status(502).json({
        message: "Marketplace media upload failed. Please try again.",
      });
    }

    if (!req.user.sellerTermsAcceptedAt) {
      req.user.sellerTermsAcceptedAt = new Date();
      await req.user.save();
    }

    const listing = await MarketplaceListing.create({
      seller: req.user._id,
      title: normalizedTitle,
      description: normalizedDescription,
      price: parsedPrice,
      category,
      images: [
        ...normalizedImages,
        ...uploadedAssets.map((asset) => asset.secureUrl),
      ],
      institution: req.user.institution,
      campus: req.user.campus,
      condition: condition || "new",
      stock: parsedStock,
    });

    return res.status(201).json({
      message: "Listing created successfully",
      listing,
    });
  } catch (error) {
    await removeUploadedMedia(uploadedAssets);
    console.error("Create listing error:", error);

    return res.status(500).json({
      message: "Failed to create listing",
    });
  }
};

export const getMarketplaceListings = async (req, res) => {
  try {
    const { category, search } = req.query;

    const filter = {
      institution: req.user.institution,
      campus: req.user.campus,
      status: "active",
      stock: { $gt: 0 },
    };

    if (category) {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const listings = await MarketplaceListing.find(filter)
      .populate("seller", "name email profile.avatar")
      .sort({ createdAt: -1 });

    res.json({
      count: listings.length,
      listings,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch marketplace listings",
      error: error.message,
    });
  }
};

export const getListingById = async (req, res) => {
  try {
    const listing = await MarketplaceListing.findById(req.params.id).populate(
      "seller",
      "name email profile.avatar",
    );

    if (!listing) {
      return res.status(404).json({
        message: "Listing not found",
      });
    }

    listing.views += 1;
    await listing.save();

    res.json({
      listing,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch listing",
      error: error.message,
    });
  }
};

export const updateListing = async (req, res) => {
  try {
    const listing = await MarketplaceListing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({
        message: "Listing not found",
      });
    }

    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You can only edit your own listings",
      });
    }

    const allowedFields = [
      "title",
      "description",
      "price",
      "category",
      "images",
      "condition",
      "stock",
      "status",
    ];

    if (req.body.images !== undefined) {
      const normalizedImages = normalizeImageUrls(req.body.images);
      if (normalizedImages === null) {
        return res.status(400).json({
          message: "Listing image URLs must be valid HTTP or HTTPS URLs",
        });
      }

      listing.images = normalizedImages;
    }

    allowedFields.forEach((field) => {
      if (field !== "images" && req.body[field] !== undefined) {
        listing[field] = req.body[field];
      }
    });

    await listing.save();

    res.json({
      message: "Listing updated successfully",
      listing,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update listing",
      error: error.message,
    });
  }
};

export const deleteListing = async (req, res) => {
  try {
    const listing = await MarketplaceListing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({
        message: "Listing not found",
      });
    }

    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You can only delete your own listings",
      });
    }

    await listing.deleteOne();

    res.json({
      message: "Listing deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete listing",
      error: error.message,
    });
  }
};
