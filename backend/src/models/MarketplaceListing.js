import mongoose from "mongoose";

const marketplaceListingSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    category: {
      type: String,
      required: true,
      enum: [
        "electronics",
        "fashion",
        "books",
        "food",
        "services",
        "school_items",
        "others",
      ],
    },

    images: [
      {
        type: String,
      },
    ],

    institution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    },

    campus: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    condition: {
      type: String,
      enum: ["new", "used", "fair"],
      default: "new",
    },

    stock: {
      type: Number,
      default: 1,
      min: 0,
    },

    status: {
      type: String,
      enum: ["active", "sold", "hidden"],
      default: "active",
    },

    views: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

const MarketplaceListing = mongoose.model(
  "MarketplaceListing",
  marketplaceListingSchema,
);

export default MarketplaceListing;
