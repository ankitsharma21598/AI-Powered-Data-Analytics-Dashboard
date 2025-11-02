import express from "express";
import {
  getInsights,
  getInsight,
  createInsight,
  updateInsight,
  deleteInsight,
  generateAIInsight,
  duplicateInsight,
  getInsightsByDataset,
  getInsightStats,
  shareInsight,
  unshareInsight,
  publishInsight,
  archiveInsight,
} from "../controllers/insightController.js";
import { protect, rateLimitByUser } from "../middleware/auth.js";

const router = express.Router();

// ============================================
// All routes are protected (require authentication)
// ============================================
router.use(protect);

// Insight statistics and analytics
router.get("/stats", getInsightStats);

// AI insight generation (with rate limiting to prevent abuse)
router.post("/generate", rateLimitByUser(20, 60000), generateAIInsight); // 20 AI requests per minute

// Get insights by dataset
router.get("/dataset/:datasetId", getInsightsByDataset);

// Insight CRUD operations
router.get("/", getInsights);
router.get("/:id", getInsight);
router.post("/", createInsight);
router.put("/:id", updateInsight);
router.delete("/:id", deleteInsight);

// Insight utilities
router.post("/:id/duplicate", duplicateInsight);

// Insight sharing
router.post("/:id/share", shareInsight);
router.delete("/:id/share/:userId", unshareInsight);

// Insight status management
router.patch("/:id/publish", publishInsight);
router.patch("/:id/archive", archiveInsight);

export default router;
