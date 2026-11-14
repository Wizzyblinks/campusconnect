import mongoose from "mongoose";

export const campusServiceCategories = [
  "Barber",
  "Tailoring",
  "Laundry",
  "Printing and Photocopying",
  "Phone and Computer Repairs",
  "Food and Catering",
  "Shops and Provisions",
  "Other",
];

const campusServiceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    category: {
      type: String,
      required: true,
      enum: campusServiceCategories,
    },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    provider: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    address: { type: String, required: true, trim: true, maxlength: 200 },
    priceArrangement: { type: String, trim: true, maxlength: 200, default: "Contact provider" },
    availability: { type: String, trim: true, maxlength: 160, default: "Contact provider" },
    imageUrl: { type: String, trim: true, default: "" },
    imagePublicId: { type: String, select: false, default: "" },
    views: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    removedAt: { type: Date, default: null },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    moderationRemoved: { type: Boolean, default: false },
    institution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    },
    campus: { type: mongoose.Schema.Types.ObjectId, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

campusServiceSchema.index({ institution: 1, campus: 1, active: 1, views: -1, createdAt: -1 });
campusServiceSchema.index({ owner: 1, institution: 1, campus: 1 });

const CampusService = mongoose.model("CampusService", campusServiceSchema);

export default CampusService;
