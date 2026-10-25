import mongoose from "mongoose";
import CampusService, {
  campusServiceCategories,
} from "../models/CampusService.js";
import cloudinary, {
  isCloudinaryConfigured,
} from "../config/cloudinary.js";

const textFields = ["name", "description", "provider", "address"];

const normalizeText = (value, maximumLength) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return normalized && normalized.length <= maximumLength ? normalized : null;
};

const normalizePhone = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const phone = value.trim().replace(/[\s().-]/g, "");
  if (!/^\+?\d{7,15}$/.test(phone)) {
    return null;
  }

  return phone;
};

const parseActive = (value) => {
  if (value === true || value === "true") {
    return true;
  }
  if (value === false || value === "false") {
    return false;
  }
  return null;
};

const normalizeServiceFields = (body, { creating }) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Provide valid service fields" };
  }

  const fields = {};

  for (const field of textFields) {
    if (!creating && body[field] === undefined) {
      continue;
    }
    const limits = {
      name: 100,
      description: 1000,
      provider: 100,
      address: 200,
    };
    fields[field] = normalizeText(body[field], limits[field]);
    if (!fields[field]) {
      return { error: `${field} is required and must be within its length limit` };
    }
  }

  if (creating || body.category !== undefined) {
    if (!campusServiceCategories.includes(body.category)) {
      return { error: "Select a valid service category" };
    }
    fields.category = body.category;
  }

  if (creating || body.phone !== undefined) {
    fields.phone = normalizePhone(body.phone);
    if (!fields.phone) {
      return { error: "Enter a valid phone number" };
    }
  }

  if (creating || body.active !== undefined) {
    fields.active = parseActive(body.active);
    if (fields.active === null) {
      return { error: "Active status must be true or false" };
    }
  }

  return { fields };
};

const uploadImage = (file) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "campus-connect/services", resource_type: "image" },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result?.secure_url || !result?.public_id) {
          reject(new Error("Image storage did not return a secure URL"));
          return;
        }

        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(file.buffer);
  });

const deleteImage = async (publicId) => {
  if (!publicId || !isCloudinaryConfigured()) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (error) {
    console.error("Campus service image cleanup failed:", error.message);
  }
};

const serializeService = (service) => {
  const serialized =
    typeof service.toObject === "function" ? service.toObject() : { ...service };
  delete serialized.imagePublicId;
  delete serialized.createdBy;
  delete serialized.__v;
  return serialized;
};

const validateServiceId = (id, res) => {
  if (mongoose.isValidObjectId(id)) {
    return true;
  }
  res.status(400).json({ message: "Invalid campus service ID" });
  return false;
};

const imageError = (res, error) => {
  console.error("Campus service image upload failed:", error.message);
  return res.status(502).json({
    message: "Service image upload failed. Please try again.",
  });
};

export const getServices = async (req, res) => {
  try {
    const { search = "", category } = req.query;
    if (typeof search !== "string" || search.length > 100) {
      return res.status(400).json({ message: "Search must be 100 characters or fewer" });
    }
    if (
      category !== undefined &&
      !campusServiceCategories.includes(category)
    ) {
      return res.status(400).json({ message: "Select a valid service category" });
    }

    const filter = {
      institution: req.user.institution,
      campus: req.user.campus,
      active: true,
    };
    if (category) {
      filter.category = category;
    }
    if (search.trim()) {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { category: { $regex: escapedSearch, $options: "i" } },
        { description: { $regex: escapedSearch, $options: "i" } },
        { provider: { $regex: escapedSearch, $options: "i" } },
        { address: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const services = await CampusService.find(filter)
      .select("-imagePublicId -createdBy -__v")
      .sort({ name: 1 })
      .limit(200)
      .lean();
    return res.json({ services });
  } catch (error) {
    console.error("Campus services listing error:", error.message);
    return res.status(500).json({ message: "Failed to load campus services" });
  }
};

export const getAdminServices = async (req, res) => {
  try {
    const services = await CampusService.find({
      institution: req.user.institution,
      campus: req.user.campus,
    })
      .select("-imagePublicId -createdBy -__v")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    return res.json({ services });
  } catch (error) {
    console.error("Campus service administration listing error:", error.message);
    return res.status(500).json({ message: "Failed to load service records" });
  }
};

export const createService = async (req, res) => {
  let uploadedImage;
  try {
    const { fields, error } = normalizeServiceFields(req.body, {
      creating: true,
    });
    if (error) {
      return res.status(400).json({ message: error });
    }
    if (req.file && !Buffer.isBuffer(req.file.buffer)) {
      return res.status(400).json({ message: "Service image could not be read" });
    }
    if (req.file && !isCloudinaryConfigured()) {
      return res.status(503).json({
        message: "Service image storage is not configured. Contact support.",
      });
    }

    if (req.file) {
      try {
        uploadedImage = await uploadImage(req.file);
      } catch (error) {
        return imageError(res, error);
      }
    }

    const service = await CampusService.create({
      ...fields,
      imageUrl: uploadedImage?.url || "",
      imagePublicId: uploadedImage?.publicId || "",
      institution: req.user.institution,
      campus: req.user.campus,
      createdBy: req.user._id,
    });
    return res.status(201).json({
      message: "Campus service created successfully",
      service: serializeService(service),
    });
  } catch (error) {
    await deleteImage(uploadedImage?.publicId);
    console.error("Campus service creation error:", error.message);
    return res.status(500).json({ message: "Failed to create campus service" });
  }
};

export const updateService = async (req, res) => {
  let uploadedImage;
  try {
    if (!validateServiceId(req.params.id, res)) {
      return;
    }
    const { fields, error } = normalizeServiceFields(req.body, {
      creating: false,
    });
    if (error) {
      return res.status(400).json({ message: error });
    }
    if (!Object.keys(fields).length && !req.file) {
      return res.status(400).json({ message: "Provide service fields to update" });
    }
    if (req.file && !Buffer.isBuffer(req.file.buffer)) {
      return res.status(400).json({ message: "Service image could not be read" });
    }
    if (req.file && !isCloudinaryConfigured()) {
      return res.status(503).json({
        message: "Service image storage is not configured. Contact support.",
      });
    }

    const service = await CampusService.findOne({
      _id: req.params.id,
      institution: req.user.institution,
      campus: req.user.campus,
    }).select("+imagePublicId");
    if (!service) {
      return res.status(404).json({ message: "Campus service not found" });
    }

    const previousImagePublicId = service.imagePublicId;
    if (req.file) {
      try {
        uploadedImage = await uploadImage(req.file);
      } catch (error) {
        return imageError(res, error);
      }
      service.imageUrl = uploadedImage.url;
      service.imagePublicId = uploadedImage.publicId;
    }

    Object.assign(service, fields);
    await service.save();
    if (uploadedImage) {
      await deleteImage(previousImagePublicId);
    }
    return res.json({
      message: "Campus service updated successfully",
      service: serializeService(service),
    });
  } catch (error) {
    await deleteImage(uploadedImage?.publicId);
    console.error("Campus service update error:", error.message);
    return res.status(500).json({ message: "Failed to update campus service" });
  }
};

export const deleteService = async (req, res) => {
  try {
    if (!validateServiceId(req.params.id, res)) {
      return;
    }
    const service = await CampusService.findOne({
      _id: req.params.id,
      institution: req.user.institution,
      campus: req.user.campus,
    }).select("+imagePublicId");
    if (!service) {
      return res.status(404).json({ message: "Campus service not found" });
    }

    await service.deleteOne();
    await deleteImage(service.imagePublicId);
    return res.json({ message: "Campus service deleted successfully" });
  } catch (error) {
    console.error("Campus service deletion error:", error.message);
    return res.status(500).json({ message: "Failed to delete campus service" });
  }
};
