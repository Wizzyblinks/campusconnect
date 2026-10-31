import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  createFollowRequest,
  getFollowList,
  getFollowRequests,
  getFollowState,
  updateFollowRequest,
} from "../controllers/followController.js";

const router = express.Router();

router.get("/requests", protect, getFollowRequests);
router.get("/:id/followers", protect, (req, res, next) => {
  req.params.list = "followers";
  return getFollowList(req, res, next);
});
router.get("/:id/following", protect, (req, res, next) => {
  req.params.list = "following";
  return getFollowList(req, res, next);
});
router.get("/:id", protect, getFollowState);
router.post("/:id", protect, createFollowRequest);
router.patch("/:id", protect, updateFollowRequest);

export default router;
