import MarketplaceListing from "../models/MarketplaceListing.js";
import cloudinary from "../config/cloudinary.js";

const uploadImage = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "campus-connect/marketplace",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve(result.secure_url);
      },
    );

    stream.end(buffer);
  });
};

export const createListing = async (req, res) => {
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

    if (!title || !description || price === undefined || !category) {
      return res.status(400).json({
        message: "Title, description, price and category are required",
      });
    }

    if (!req.user.sellerTermsAcceptedAt && sellerTermsAccepted !== "true") {
      return res.status(400).json({
        message:
          "You must accept the seller terms before publishing your first listing",
      });
    }

    const existingImages = Array.isArray(images)
      ? images
      : images
        ? [images]
        : [];

    const uploadedImages = await Promise.all(
      (req.files || []).map((file) => uploadImage(file.buffer)),
    );

    if (!req.user.sellerTermsAcceptedAt) {
      req.user.sellerTermsAcceptedAt = new Date();
      await req.user.save();
    }

    const listing = await MarketplaceListing.create({
      seller: req.user._id,
      title,
      description,
      price,
      category,
      images: [...existingImages, ...uploadedImages],
      institution: req.user.institution,
      campus: req.user.campus,
      condition: condition || "new",
      stock: stock === undefined ? 1 : stock,
    });

    return res.status(201).json({
      message: "Listing created successfully",
      listing,
    });
  } catch (error) {
    console.error("Create listing error:", error);

    return res.status(500).json({
      message: "Failed to create listing",
      error: error.message,
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

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
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
