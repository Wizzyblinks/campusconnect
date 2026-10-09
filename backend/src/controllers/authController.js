import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Institution from "../models/Institution.js";

export const register = async (req, res) => {
  try {
    const { name, email, password, institution, campus } = req.body;

    if (!name || !email || !password || !institution || !campus) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    const institutionDoc = await Institution.findById(institution);

    if (!institutionDoc) {
      return res.status(404).json({
        message: "Institution not found",
      });
    }

    const campusExists = institutionDoc.campuses.some(
      (item) => item._id.toString() === campus,
    );

    if (!campusExists) {
      return res.status(400).json({
        message: "Campus does not belong to this institution",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      institution,
      campus,
    });

    return res.status(201).json({
      message: "Registration successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        institution: user.institution,
        campus: user.campus,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Registration failed",
      error: error.message,
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (user.isRestricted) {
      return res.status(403).json({
        message: "Your account has been restricted",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        institution: user.institution,
        campus: user.campus,
        role: user.role,
        isVerifiedStudent: user.isVerifiedStudent,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Login failed",
      error: error.message,
    });
  }
};
