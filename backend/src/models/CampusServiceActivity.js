import mongoose from "mongoose";

const campusServiceActivitySchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "CampusService", default: null },
    request: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceRequest", default: null },
    institution: { type: mongoose.Schema.Types.ObjectId, ref: "Institution", required: true },
    campus: { type: mongoose.Schema.Types.ObjectId, required: true },
    action: {
      type: String,
      enum: [
        "SERVICE_CREATED",
        "SERVICE_UPDATED",
        "SERVICE_REMOVED",
        "REQUEST_APPROVED",
        "REQUEST_REJECTED",
      ],
      required: true,
    },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

campusServiceActivitySchema.index({ institution: 1, campus: 1, createdAt: -1 });

export default mongoose.model("CampusServiceActivity", campusServiceActivitySchema);
