import mongoose from "mongoose";
import CampusService, {
  campusServiceCategories,
} from "../models/CampusService.js";
import CampusServiceActivity from "../models/CampusServiceActivity.js";
import ServiceRequest from "../models/ServiceRequest.js";
import User from "../models/User.js";
import { isValidServiceImage } from "../services/serviceMediaValidation.js";
import cloudinary, {
  isCloudinaryConfigured,
} from "../config/cloudinary.js";

const textFields = [
  "name",
  "description",
  "provider",
  "address",
  "priceArrangement",
  "availability",
];

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
      priceArrangement: 200,
      availability: 160,
    };
    const defaults = {
      priceArrangement: "Contact provider",
      availability: "Contact provider",
    };
    const emptyOptionalText = defaults[field] &&
      (body[field] === undefined ||
        (typeof body[field] === "string" && body[field].trim() === ""));
    fields[field] = emptyOptionalText
      ? defaults[field]
      : normalizeText(body[field], limits[field]);
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

  if (body.active !== undefined) {
    fields.active = parseActive(body.active);
    if (fields.active === null) {
      return { error: "Active status must be true or false" };
    }
  } else if (creating) {
    fields.active = true;
  }

  return { fields };
};

const uploadImage = (file) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "campus-connect/services",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
      },
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

const deleteImageIfUnused = async (publicId, excludedServiceId = null) => {
  if (!publicId) return;
  const serviceFilter = { imagePublicId: publicId };
  if (excludedServiceId) serviceFilter._id = { $ne: excludedServiceId };
  const [serviceReference, requestReference] = await Promise.all([
    CampusService.exists(serviceFilter),
    ServiceRequest.exists({ imagePublicId: publicId }),
  ]);
  if (!serviceReference && !requestReference) await deleteImage(publicId);
};

const serializeService = (service) => {
  const serialized =
    typeof service.toObject === "function" ? service.toObject() : { ...service };
  delete serialized.imagePublicId;
  delete serialized.createdBy;
  delete serialized.updatedBy;
  delete serialized.removedBy;
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

const serviceScope = (user) => ({
  institution: user.institution,
  campus: user.campus,
});

const recordServiceActivity = (user, action, { service = null, request = null, details = {} } = {}) =>
  CampusServiceActivity.create({
    actor: user._id,
    service,
    request,
    institution: user.institution,
    campus: user.campus,
    action,
    details,
  });

const imageError = (res, error) => {
  console.error("Campus service image upload failed:", error.message);
  return res.status(502).json({
    message: "Service image upload failed. Please try again.",
  });
};

export const getServices = async (req, res) => {
  try {
    const { search = "", category, track } = req.query;
    if (typeof search !== "string" || search.length > 100 ||
        (track !== undefined && track !== "1" && track !== "0")) {
      return res.status(400).json({ message: "Choose valid service search and tracking options." });
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
      .select("-imagePublicId -createdBy -updatedBy -removedBy -__v")
      .populate("owner", "name")
      .sort({ views: -1, createdAt: -1 })
      .limit(200)
      .lean();
    if (track === "1" && services.length) {
      await CampusService.updateMany(
        { _id: { $in: services.map((service) => service._id) } },
        { $inc: { views: 1 } },
      );
      services.forEach((service) => { service.views += 1; });
    }
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
      .select("-imagePublicId -createdBy -updatedBy -removedBy -__v")
      .populate("owner", "name")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    return res.json({ services });
  } catch (error) {
    console.error("Campus service administration listing error:", error.message);
    return res.status(500).json({ message: "Failed to load service records" });
  }
};

export const getMyServices = async (req, res) => {
  try {
    const services = await CampusService.find({
      ...serviceScope(req.user),
      owner: req.user._id,
    })
      .select("-imagePublicId -createdBy -updatedBy -removedBy -__v")
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
    return res.json({ services });
  } catch (error) {
    console.error("Load owned campus services failed:", error.message);
    return res.status(500).json({ message: "Failed to load your campus services" });
  }
};

export const getMyServiceRequests = async (req, res) => {
  try {
    const requests = await ServiceRequest.find({
      requester: req.user._id,
      ...serviceScope(req.user),
    })
      .select("-imagePublicId -normalizedName -__v")
      .populate("service", "name active")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({ requests });
  } catch (error) {
    console.error("Load service requests failed:", error.message);
    return res.status(500).json({ message: "Failed to load your service requests" });
  }
};

export const getAdminServiceRequests = async (req, res) => {
  try {
    const requests = await ServiceRequest.find({
      ...serviceScope(req.user),
      status: "PENDING",
    })
      .select("-imagePublicId -normalizedName -__v")
      .populate("requester", "name profile.avatar")
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();
    return res.json({ requests });
  } catch (error) {
    console.error("Load pending service requests failed:", error.message);
    return res.status(500).json({ message: "Failed to load pending service requests" });
  }
};

export const createService = async (req, res) => {
  let uploadedImage;
  let createdService;
  try {
    const { fields, error } = normalizeServiceFields(req.body, {
      creating: true,
    });
    if (error) {
      return res.status(400).json({ message: error });
    }
    if (req.file && !isValidServiceImage(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ message: "Choose a valid JPG, PNG, or WebP service image." });
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

    createdService = await CampusService.create({
      ...fields,
      imageUrl: uploadedImage?.url || "",
      imagePublicId: uploadedImage?.publicId || "",
      institution: req.user.institution,
      campus: req.user.campus,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    await recordServiceActivity(req.user, "SERVICE_CREATED", {
      service: createdService._id,
      details: { name: createdService.name, ownerManaged: false },
    });
    return res.status(201).json({
      message: "Campus service created successfully",
      service: serializeService(createdService),
    });
  } catch (error) {
    if (createdService) await CampusService.deleteOne({ _id: createdService._id });
    await deleteImage(uploadedImage?.publicId);
    console.error("Campus service creation error:", error.message);
    return res.status(500).json({ message: "Failed to create campus service" });
  }
};

export const createServiceRequest = async (req, res) => {
  let uploadedImage;
  try {
    const { fields, error } = normalizeServiceFields(req.body, { creating: true });
    if (error) return res.status(400).json({ message: error });
    const normalizedName = fields.name.toLowerCase();
    if (await ServiceRequest.exists({
      requester: req.user._id,
      normalizedName,
      status: "PENDING",
    })) {
      return res.status(409).json({
        message: "You already have a pending request for a service with this name.",
      });
    }
    if (req.file && !isValidServiceImage(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ message: "Choose a valid JPG, PNG, or WebP service image." });
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

    const requestFields = { ...fields };
    delete requestFields.active;
    const request = await ServiceRequest.create({
      ...requestFields,
      normalizedName,
      imageUrl: uploadedImage?.url || "",
      imagePublicId: uploadedImage?.publicId || "",
      requester: req.user._id,
      institution: req.user.institution,
      campus: req.user.campus,
    });
    uploadedImage = null;
    return res.status(201).json({
      message: "Your service request was sent to campus administrators for review.",
      request: {
        ...request.toObject(),
        imagePublicId: undefined,
        normalizedName: undefined,
      },
    });
  } catch (error) {
    await deleteImage(uploadedImage?.publicId);
    if (error.code === 11000) {
      return res.status(409).json({
        message: "You already have a pending request for a service with this name.",
      });
    }
    console.error("Create service request failed:", error.message);
    return res.status(500).json({ message: "Failed to submit your service request" });
  }
};

export const reviewServiceRequest = async (req, res) => {
  let createdService;
  let claimedRequest;
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid service request ID." });
    }
    const { status, reviewNote = "" } = req.body || {};
    if (!["APPROVED", "REJECTED"].includes(status) ||
        typeof reviewNote !== "string" || reviewNote.trim().length > 500) {
      return res.status(400).json({ message: "Choose an approval decision and a note of up to 500 characters." });
    }

    claimedRequest = await ServiceRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        ...serviceScope(req.user),
        status: "PENDING",
      },
      {
        $set: {
          status,
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
          reviewNote: reviewNote.trim(),
        },
      },
      { new: true, runValidators: true },
    ).select("+imagePublicId");
    if (!claimedRequest) {
      return res.status(404).json({ message: "Pending service request not found." });
    }

    if (status === "REJECTED") {
      await recordServiceActivity(req.user, "REQUEST_REJECTED", {
        request: claimedRequest._id,
        details: { name: claimedRequest.name, reviewNote: reviewNote.trim() },
      });
      return res.json({
        message: "Service request declined.",
        request: {
          ...claimedRequest.toObject(),
          imagePublicId: undefined,
          normalizedName: undefined,
        },
      });
    }

    const requester = await User.findOne({
      _id: claimedRequest.requester,
      ...serviceScope(req.user),
      isRestricted: { $ne: true },
    }).select("name");
    if (!requester) {
      await ServiceRequest.updateOne(
        { _id: claimedRequest._id, status: "APPROVED" },
        { $set: { status: "PENDING", reviewedBy: null, reviewedAt: null, reviewNote: "" } },
      );
      return res.status(409).json({ message: "The service owner is no longer eligible to publish this listing." });
    }

    createdService = await CampusService.create({
      name: claimedRequest.name,
      category: claimedRequest.category,
      description: claimedRequest.description,
      provider: claimedRequest.provider,
      phone: claimedRequest.phone,
      address: claimedRequest.address,
      priceArrangement: claimedRequest.priceArrangement,
      availability: claimedRequest.availability,
      imageUrl: claimedRequest.imageUrl,
      imagePublicId: claimedRequest.imagePublicId,
      active: true,
      owner: requester._id,
      institution: claimedRequest.institution,
      campus: claimedRequest.campus,
      createdBy: requester._id,
      updatedBy: req.user._id,
    });
    claimedRequest.service = createdService._id;
    await claimedRequest.save();
    await recordServiceActivity(req.user, "REQUEST_APPROVED", {
      service: createdService._id,
      request: claimedRequest._id,
      details: { name: claimedRequest.name },
    });
    return res.json({
      message: "Service request approved and published.",
      request: {
        ...claimedRequest.toObject(),
        imagePublicId: undefined,
        normalizedName: undefined,
      },
      service: serializeService(createdService),
    });
  } catch (error) {
    if (createdService) {
      await CampusService.deleteOne({ _id: createdService._id });
    }
    if (claimedRequest) {
      await ServiceRequest.updateOne(
        {
          _id: claimedRequest._id,
          status: claimedRequest.status,
          reviewedBy: req.user._id,
        },
        { $set: { status: "PENDING", reviewedBy: null, reviewedAt: null, reviewNote: "", service: null } },
      );
    }
    console.error("Review service request failed:", error.message);
    return res.status(500).json({ message: "Could not complete the service request review." });
  }
};

export const updateService = async (req, res) => {
  let uploadedImage;
  let persisted = false;
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
    if (req.file && !isValidServiceImage(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ message: "Choose a valid JPG, PNG, or WebP service image." });
    }
    if (req.file && !isCloudinaryConfigured()) {
      return res.status(503).json({
        message: "Service image storage is not configured. Contact support.",
      });
    }

    const serviceFilter = {
      _id: req.params.id,
      ...serviceScope(req.user),
    };
    if (req.user.role !== "admin") {
      serviceFilter.owner = req.user._id;
    }
    const service = await CampusService.findOne(serviceFilter).select("+imagePublicId");
    if (!service) {
      return res.status(404).json({ message: "Campus service not found" });
    }
    if (req.user.role !== "admin" && service.moderationRemoved) {
      return res.status(403).json({ message: "This listing was removed by campus administrators." });
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

    const wasActive = service.active;
    Object.assign(service, fields);
    service.updatedBy = req.user._id;
    if (fields.active === false && wasActive) {
      service.removedAt = new Date();
      service.removedBy = req.user._id;
      service.moderationRemoved = req.user.role === "admin";
    } else if (fields.active === true) {
      service.removedAt = null;
      service.removedBy = null;
      service.moderationRemoved = false;
    }
    await service.save();
    persisted = true;
    if (uploadedImage) {
      await deleteImageIfUnused(previousImagePublicId, service._id);
    }
    const action = fields.active === false && wasActive
      ? "SERVICE_REMOVED"
      : "SERVICE_UPDATED";
    await recordServiceActivity(req.user, action, {
      service: service._id,
      details: { name: service.name },
    });
    return res.json({
      message: "Campus service updated successfully",
      service: serializeService(service),
    });
  } catch (error) {
    if (!persisted) await deleteImage(uploadedImage?.publicId);
    console.error("Campus service update error:", error.message);
    return res.status(500).json({ message: "Failed to update campus service" });
  }
};

export const deleteService = async (req, res) => {
  try {
    if (!validateServiceId(req.params.id, res)) {
      return;
    }
    const serviceFilter = { _id: req.params.id, ...serviceScope(req.user) };
    if (req.user.role !== "admin") {
      serviceFilter.owner = req.user._id;
    }
    const service = await CampusService.findOne(serviceFilter).select("+imagePublicId");
    if (!service) {
      return res.status(404).json({ message: "Campus service not found" });
    }

    service.active = false;
    service.removedAt = new Date();
    service.removedBy = req.user._id;
    service.moderationRemoved = req.user.role === "admin";
    service.updatedBy = req.user._id;
    await service.save();
    await recordServiceActivity(req.user, "SERVICE_REMOVED", {
      service: service._id,
      details: { name: service.name },
    });
    return res.json({ message: "Campus service removed from the directory." });
  } catch (error) {
    console.error("Campus service deletion error:", error.message);
    return res.status(500).json({ message: "Failed to delete campus service" });
  }
};
