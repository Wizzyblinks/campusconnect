import verifyStudentDocument from "../services/aiVerificationService.js";
import Verification from "../models/Verification.js";
import User from "../models/User.js";

export const submitVerification = async (req, res) => {
  try {
    const { documentType } = req.body;

    if (!documentType || !req.file) {
      return res.status(400).json({
        message: "Document type and document file are required",
      });
    }

    const existingVerification = await Verification.findOne({
      user: req.user._id,
    });

    if (existingVerification) {
      return res.status(409).json({
        message: "Verification already submitted",
      });
    }

    const aiResult = await verifyStudentDocument(req.file, documentType);

    let finalStatus = "manual_review";

    if (aiResult.decision === "rejected" || aiResult.confidence < 60) {
      finalStatus = "rejected";
    } else if (
      aiResult.decision === "approved" &&
      aiResult.confidence >= 90 &&
      aiResult.documentTypeMatch === true &&
      aiResult.institutionDetected === true &&
      aiResult.studentNameDetected === true &&
      aiResult.studentIdDetected === true
    ) {
      finalStatus = "approved";
    }

    const verification = await Verification.create({
      user: req.user._id,
      documentType,
      documentUrl: "uploaded-file",
      status: finalStatus,
      aiConfidence: aiResult.confidence,
      rejectionReason: finalStatus === "rejected" ? aiResult.reason : "",
    });

    if (finalStatus === "approved") {
      await User.findByIdAndUpdate(req.user._id, {
        isVerifiedStudent: true,
      });
    }

    res.status(201).json({
      message: "Verification processed successfully",
      verification,
      ai: aiResult,
    });
  } catch (error) {
    console.error("AI verification error:", error);

    res.status(500).json({
      message: "Verification processing failed",
      error: error.message,
    });
  }
};

export const getVerificationStatus = async (req, res) => {
  try {
    const verification = await Verification.findOne({
      user: req.user._id,
    }).select("-documentUrl");

    res.json({
      verification,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch verification status",
      error: error.message,
    });
  }
};

export const getPendingVerifications = async (req, res) => {
  try {
    const verifications = await Verification.find({
      status: "pending",
    })
      .populate("user", "name email institution campus")
      .sort({ createdAt: -1 });

    res.json({
      verifications,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch pending verifications",
      error: error.message,
    });
  }
};

export const reviewVerification = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;

    if (!["approved", "rejected", "manual_review"].includes(status)) {
      return res.status(400).json({
        message: "Invalid verification status",
      });
    }

    const verification = await Verification.findById(req.params.id);

    if (!verification) {
      return res.status(404).json({
        message: "Verification not found",
      });
    }

    verification.status = status;
    verification.reviewedBy = req.user._id;

    if (status === "rejected") {
      verification.rejectionReason = rejectionReason || "Document rejected";
    }

    await verification.save();

    if (status === "approved") {
      await User.findByIdAndUpdate(verification.user, {
        isVerifiedStudent: true,
      });
    }

    if (status === "rejected") {
      await User.findByIdAndUpdate(verification.user, {
        isVerifiedStudent: false,
      });
    }

    res.json({
      message: `Verification ${status}`,
      verification,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to review verification",
      error: error.message,
    });
  }
};
