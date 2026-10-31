import MarketplaceListing from "../models/MarketplaceListing.js";
import cloudinary, { isCloudinaryConfigured } from "../config/cloudinary.js";
import { PUBLIC_PROFILE_FIELDS } from "../services/publicProfileProjection.js";

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
const isImageBuffer = (buffer) =>
  (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) ||
  buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
  /^GIF8[79]a$/.test(buffer.subarray(0, 6).toString("ascii")) ||
  (buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP");

const normalizeImageUrls = (images) => {
  let inputImages = images;
  if (typeof inputImages === "string" && inputImages.trim().startsWith("[")) {
    try {
      inputImages = JSON.parse(inputImages);
    } catch {
      return null;
    }
  }
  const urls =
    inputImages === undefined || inputImages === null || inputImages === ""
      ? []
      : Array.isArray(inputImages)
        ? inputImages
        : [inputImages];

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
    if (normalizedImages.length + files.length > 4) {
      return res.status(400).json({
        message: "A listing can have no more than four photos.",
      });
    }
    if (files.some((file) =>
      !Buffer.isBuffer(file.buffer) ||
      !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.mimetype) ||
      !isImageBuffer(file.buffer),
    )) {
      return res.status(400).json({
        message: "Choose valid JPG, PNG, GIF, or WebP image files.",
      });
    }
    if (files.length > 0 && !isCloudinaryConfigured()) {
      return res.status(503).json({
        message:
          "Marketplace image storage is not configured. Please contact support.",
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
      .select("title description price category images condition stock seller createdAt")
      .populate("seller", PUBLIC_PROFILE_FIELDS)
      .sort({ createdAt: -1 });

    res.json({
      count: listings.length,
      listings,
    });
  } catch (error) {
    console.error("Fetch marketplace listings failed:", error.message);
    res.status(500).json({
      message: "Failed to fetch marketplace listings",
    });
  }
};

export const getMyListings = async (req, res) => {
  try {
    const listings = await MarketplaceListing.find({ seller: req.user._id })
      .sort({ updatedAt: -1 })
      .lean();
    return res.json({ count: listings.length, listings });
  } catch (error) {
    console.error("Fetch seller listings failed:", error.message);
    return res.status(500).json({ message: "We couldn't load your listings right now." });
  }
};

export const getListingById = async (req, res) => {
  try {
    const listing = await MarketplaceListing.findById(req.params.id)
      .select("title description price category images condition stock seller status views createdAt updatedAt")
      .populate(
      "seller",
      PUBLIC_PROFILE_FIELDS,
    );

    if (!listing) {
      return res.status(404).json({
        message: "Listing not found",
      });
    }

    const listingSellerId = listing.seller?._id || listing.seller;
    if (
      (listing.status !== "active" || listing.stock <= 0) &&
      String(listingSellerId) !== String(req.user._id)
    ) {
      return res.status(404).json({ message: "Listing not found" });
    }

    listing.views += 1;
    await listing.save();

    res.json({
      listing,
    });
  } catch (error) {
    console.error("Fetch marketplace listing failed:", error.message);
    res.status(500).json({
      message: "Failed to fetch listing",
    });
  }
};

export const updateListing = async (req, res) => {
  const uploadedAssets = [];
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

    const editableFields = ["title", "description", "price", "category", "condition", "stock"];
    if (Object.keys(req.body).some((field) => ![...editableFields, "images", "status"].includes(field))) {
      return res.status(400).json({ message: "Some listing details couldn't be updated. Please refresh and try again." });
    }

    if (req.body.title !== undefined && (typeof req.body.title !== "string" || !req.body.title.trim() || req.body.title.trim().length > 120)) {
      return res.status(400).json({ message: "Enter a title of 1 to 120 characters." });
    }
    if (req.body.description !== undefined && (typeof req.body.description !== "string" || !req.body.description.trim() || req.body.description.trim().length > 1000)) {
      return res.status(400).json({ message: "Enter a description of 1 to 1,000 characters." });
    }
    if (req.body.price !== undefined && (
      !["string", "number"].includes(typeof req.body.price) ||
      String(req.body.price).trim() === "" ||
      !Number.isFinite(Number(req.body.price)) ||
      Number(req.body.price) < 0
    )) {
      return res.status(400).json({ message: "Enter a valid price of zero or more." });
    }
    if (req.body.stock !== undefined && (
      !["string", "number"].includes(typeof req.body.stock) ||
      String(req.body.stock).trim() === "" ||
      !Number.isInteger(Number(req.body.stock)) ||
      Number(req.body.stock) < 0
    )) {
      return res.status(400).json({ message: "Stock must be a whole number of zero or more." });
    }
    if (req.body.category !== undefined && !listingCategories.includes(req.body.category)) {
      return res.status(400).json({ message: "Choose a valid product category." });
    }
    if (req.body.condition !== undefined && !listingConditions.includes(req.body.condition)) {
      return res.status(400).json({ message: "Choose a valid product condition." });
    }
    if (req.body.status !== undefined) {
      if (!["active", "hidden"].includes(req.body.status) || listing.status === "sold") {
        return res.status(400).json({ message: "This listing status can't be changed." });
      }
    }

    const files = req.files || [];
    if (files.some((file) =>
      !Buffer.isBuffer(file.buffer) ||
      !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.mimetype) ||
      !isImageBuffer(file.buffer),
    )) {
      return res.status(400).json({ message: "Choose valid JPG, PNG, GIF, or WebP image files." });
    }
    if (files.length > 0 && !isCloudinaryConfigured()) {
      return res.status(503).json({ message: "Marketplace image storage is not configured. Please contact support." });
    }

    const requestedImages = req.body.images === undefined
      ? [...listing.images]
      : normalizeImageUrls(req.body.images);
    if (requestedImages === null) {
      return res.status(400).json({ message: "Listing image URLs must be valid HTTP or HTTPS URLs." });
    }
    if (requestedImages.length + files.length > 4) {
      return res.status(400).json({ message: "A listing can have no more than four photos." });
    }

    try {
      for (const file of files) uploadedAssets.push(await uploadMedia(file));
    } catch (error) {
      await removeUploadedMedia(uploadedAssets);
      uploadedAssets.length = 0;
      console.error("Marketplace image update failed:", error.message);
      return res.status(502).json({ message: "We couldn't upload your listing photos. Please try again." });
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

    listing.images = [
      ...requestedImages,
      ...uploadedAssets.map((asset) => asset.secureUrl),
    ];

    allowedFields.forEach((field) => {
      if (field !== "images" && req.body[field] !== undefined) {
        listing[field] = field === "title" || field === "description"
          ? req.body[field].trim()
          : field === "price" || field === "stock"
            ? Number(req.body[field])
            : req.body[field];
      }
    });

    await listing.save();

    res.json({
      message: "Listing updated successfully",
      listing,
    });
  } catch (error) {
    await removeUploadedMedia(uploadedAssets);
    console.error("Update marketplace listing failed:", error.message);
    res.status(500).json({
      message: "Failed to update listing",
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

    if (listing.status === "sold") {
      return res.status(400).json({ message: "Sold listings can't be taken down." });
    }
    listing.status = "hidden";
    await listing.save();

    res.json({
      message: "Listing taken down. You can restore it from your seller dashboard.",
      listing,
    });
  } catch (error) {
    console.error("Take down marketplace listing failed:", error.message);
    res.status(500).json({
      message: "We couldn't take down this listing. Please try again.",
    });
  }
};
