import Institution from "../models/Institution.js";

export const createInstitution = async (req, res) => {
  try {
    const { name, shortName, state, campuses } = req.body;

    const institution = await Institution.create({
      name,
      shortName,
      state,
      campuses,
    });

    res.status(201).json({
      message: "Institution created",
      institution,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create institution",
      error: error.message,
    });
  }
};

export const getInstitutions = async (req, res) => {
  try {
    const institutions = await Institution.find().sort({ name: 1 });

    res.json({
      institutions,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch institutions",
      error: error.message,
    });
  }
};
