import express from "express";
import {
  createInstitution,
  getInstitutions,
} from "../controllers/institutionController.js";

const router = express.Router();

router.post("/", createInstitution);
router.get("/", getInstitutions);

export default router;
