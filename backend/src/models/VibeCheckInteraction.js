import mongoose from "mongoose";

const vibeCheckInteractionSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    target: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: ["LIKE", "PASS", "BLOCK"],
      required: true,
    },
  },
  { timestamps: true },
);

vibeCheckInteractionSchema.index({ actor: 1, target: 1 }, { unique: true });
vibeCheckInteractionSchema.index({ target: 1, action: 1 });

const VibeCheckInteraction = mongoose.model(
  "VibeCheckInteraction",
  vibeCheckInteractionSchema,
);

export default VibeCheckInteraction;
