import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    institution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    },

    campus: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    role: {
      type: String,
      enum: ["student", "admin"],
      default: "student",
    },

    profile: {
      avatar: {
        type: String,
        default: "",
      },

      phone: {
        type: String,
        default: "",
      },

      department: {
        type: String,
        default: "",
      },

      level: {
        type: String,
        default: "",
      },

      bio: {
        type: String,
        maxlength: 300,
        default: "",
      },
    },

    privacy: {
      discoverable: { type: Boolean, default: true },
      profileVisibility: {
        type: String,
        enum: ["public", "campus", "private"],
        default: "campus",
      },
      defaultPostVisibility: {
        type: String,
        enum: ["public", "campus", "private"],
        default: "campus",
      },
    },

    vibeCheck: {
      enabled: {
        type: Boolean,
        default: false,
      },
      optedInAt: {
        type: Date,
        default: null,
      },
      interests: {
        type: [{ type: String, trim: true, maxlength: 32 }],
        default: [],
      },
    },

    emailVerified: {
      type: Boolean,
      default: true,
    },

    emailVerifiedAt: {
      type: Date,
      default: null,
    },

    tokenVersion: {
      type: Number,
      default: 0,
    },

    isVerifiedStudent: {
      type: Boolean,
      default: false,
    },

    isRestricted: {
      type: Boolean,
      default: false,
    },

    restrictionReason: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
      select: false,
    },

    restrictedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      select: false,
    },

    restrictedAt: {
      type: Date,
      default: null,
      select: false,
    },

    isOnline: {
      type: Boolean,
      default: false,
    },

    sellerTermsAcceptedAt: { type: Date, default: null },

    payoutAccount: {
      accountName: { type: String, default: "" },
      accountLast4: { type: String, default: "" },
      bankCode: { type: String, default: "" },
      bankName: { type: String, default: "" },
      recipientCode: { type: String, default: "" },
      verifiedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  },
);

const User = mongoose.model("User", userSchema);

export default User;
