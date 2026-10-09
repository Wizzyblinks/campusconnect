import User from "../models/User.js";
import Institution from "../models/Institution.js";

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const institution = await Institution.findById(user.institution);

    if (!institution) {
      return res.status(404).json({
        message: "Institution not found",
      });
    }

    const campus = institution.campuses.find(
      (item) => item._id.toString() === user.campus.toString(),
    );

    res.json({
      user: {
        ...user.toObject(),
        institution: {
          id: institution._id,
          name: institution.name,
          shortName: institution.shortName,
          state: institution.state,
        },
        campus: campus ? campus.name : null,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch profile",
      error: error.message,
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, phone, department, level, bio, avatar } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.profile.phone = phone;
    if (department !== undefined) user.profile.department = department;
    if (level !== undefined) user.profile.level = level;
    if (bio !== undefined) user.profile.bio = bio;
    if (avatar !== undefined) user.profile.avatar = avatar;

    await user.save();

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        institution: user.institution,
        campus: user.campus,
        profile: user.profile,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update profile",
      error: error.message,
    });
  }
};
