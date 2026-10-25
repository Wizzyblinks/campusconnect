import News from "../models/News.js";
import mongoose from "mongoose";

const normalizeNews = (body, { creating = false } = {}) => {
  const fields = {};
  for (const field of ["title", "content"]) {
    if (!creating && body[field] === undefined) continue;
    if (typeof body[field] !== "string") {
      return { error: `${field} is required` };
    }
    const value = body[field].replace(/[\u0000-\u001F\u007F]/g, "").trim();
    const maximumLength = field === "title" ? 160 : 10000;
    if (!value || value.length > maximumLength) {
      return { error: `${field} must be within its length limit` };
    }
    fields[field] = value;
  }
  if (body.image !== undefined || creating) {
    const image = body.image === undefined ? "" : body.image;
    if (typeof image !== "string" || image.length > 2048) {
      return { error: "Image must be a valid HTTPS URL" };
    }
    if (image) {
      try {
        if (new URL(image).protocol !== "https:") {
          return { error: "Image must be a valid HTTPS URL" };
        }
      } catch {
        return { error: "Image must be a valid HTTPS URL" };
      }
    }
    fields.image = image;
  }
  if (body.isPublished !== undefined || creating) {
    const published = body.isPublished === undefined ? true : body.isPublished;
    if (typeof published !== "boolean") {
      return { error: "Publication status must be true or false" };
    }
    fields.isPublished = published;
  }
  if (!creating && !Object.keys(fields).length) {
    return { error: "Provide news fields to update" };
  }
  return { fields };
};

const newsScope = (user) => ({
  institution: user.institution,
  campus: user.campus,
});

export const createNews = async (req, res) => {
  try {
    const { fields, error } = normalizeNews(req.body, { creating: true });
    if (error) {
      return res.status(400).json({ message: error });
    }

    const news = await News.create({
      ...fields,
      institution: req.user.institution,
      campus: req.user.campus,
      author: req.user._id,
    });

    res.status(201).json({
      message: "News created successfully",
      news,
    });
  } catch (error) {
    console.error("Create news error:", error.message);
    res.status(500).json({
      message: "Failed to create news",
    });
  }
};

export const getCampusNews = async (req, res) => {
  try {
    const news = await News.find({
      institution: req.user.institution,
      campus: req.user.campus,
      isPublished: true,
    })
      .populate("author", "name")
      .sort({ createdAt: -1 });

    res.json({
      news,
    });
  } catch (error) {
    console.error("Fetch campus news error:", error.message);
    res.status(500).json({
      message: "Failed to fetch campus news",
    });
  }
};

export const getAdminNews = async (req, res) => {
  try {
    const news = await News.find(newsScope(req.user))
      .populate("author", "name")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return res.json({ news });
  } catch (error) {
    console.error("Admin news list error:", error.message);
    return res.status(500).json({ message: "Failed to load campus news records" });
  }
};

export const updateNews = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid news ID" });
    }
    const { fields, error } = normalizeNews(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }
    const news = await News.findOneAndUpdate(
      { _id: req.params.id, ...newsScope(req.user) },
      { $set: fields },
      { new: true, runValidators: true },
    ).populate("author", "name");
    if (!news) {
      return res.status(404).json({ message: "Campus news item not found" });
    }
    return res.json({ message: "Campus news updated successfully", news });
  } catch (error) {
    console.error("Update news error:", error.message);
    return res.status(500).json({ message: "Failed to update campus news" });
  }
};

export const deleteNews = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid news ID" });
    }
    const news = await News.findOneAndDelete({
      _id: req.params.id,
      ...newsScope(req.user),
    });
    if (!news) {
      return res.status(404).json({ message: "Campus news item not found" });
    }
    return res.json({ message: "Campus news deleted successfully" });
  } catch (error) {
    console.error("Delete news error:", error.message);
    return res.status(500).json({ message: "Failed to delete campus news" });
  }
};
