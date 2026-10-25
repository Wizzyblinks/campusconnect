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
    imageUrl: { type: String, trim: true, default: "" },
    imagePublicId: { type: String, select: false, default: "" },
    active: { type: Boolean, default: true },
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

const CampusService = mongoose.model("CampusService", campusServiceSchema);

export default CampusService;
