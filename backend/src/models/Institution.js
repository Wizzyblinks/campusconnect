import mongoose from "mongoose";

const institutionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    shortName: {
      type: String,
      trim: true,
    },

    state: {
      type: String,
      required: true,
      trim: true,
    },

    campuses: [
      {
        name: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

const Institution = mongoose.model("Institution", institutionSchema);

export default Institution;
