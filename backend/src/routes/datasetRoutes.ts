import express from "express";
import {
  getDatasets,
  getDataset,
  updateDataset,
  deleteDataset,
  getDatasetStats,
  getDatasetPreview,
  downloadDataset,
  duplicateDataset,
} from "../controllers/datasetController.js";
import { protect, rateLimitByUser } from "../middleware/auth.js";

const router = express.Router();

// ============================================
// All routes are protected (require authentication)
// ============================================
router.use(protect);

// Dataset listing and retrieval
// router.get("/", getDataset);
router.get("/:id", getDataset);
router.get("/", getDatasets);

// Dataset operations
router.put("/:id", updateDataset);
router.delete("/:id", deleteDataset);

// Dataset analytics and utilities
router.get("/:id/stats", getDatasetStats);
router.get("/:id/preview", getDatasetPreview);
router.get("/:id/download", rateLimitByUser(10, 60000), downloadDataset); // 10 downloads per minute
router.post("/:id/duplicate", duplicateDataset);

export default router;
