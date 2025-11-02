import express from "express";
import {
  uploadFile,
  processFile,
  getUploadStatus,
  validateFile,
} from "../controllers/uploadController.js";
import { protect } from "../middleware/auth.js";
import {
  upload,
  validateFileMetadata,
  cleanupOnError,
} from "../middleware/upload.js";

const router = express.Router();

// ============================================
// All routes are protected (require authentication)
// ============================================
router.use(protect);

// ============================================
// File Upload Routes
// ============================================

/**
 * @route   POST /api/upload
 * @desc    Upload a file (CSV, JSON, Excel)
 * @access  Private
 * @body    multipart/form-data
 *          - file: File (required)
 *          - name: string (optional)
 *          - description: string (optional)
 *          - tags: string[] as JSON (optional)
 */
router.post(
  "/",
  upload.single("file"), // Handle file upload
  validateFileMetadata, // Validate uploaded file
  cleanupOnError, // Cleanup on error
  uploadFile // Process upload
);

/**
 * @route   POST /api/upload/validate
 * @desc    Validate file without saving (dry run)
 * @access  Private
 * @body    multipart/form-data
 *          - file: File (required)
 */
router.post("/validate", upload.single("file"), validateFile);

// ============================================
// Processing Routes
// ============================================

/**
 * @route   POST /api/upload/:datasetId/process
 * @desc    Manually trigger file processing for a dataset
 * @access  Private
 * @param   datasetId - Dataset ID
 */
router.post("/:datasetId/process", processFile);

/**
 * @route   GET /api/upload/:datasetId/status
 * @desc    Get processing status of uploaded file
 * @access  Private
 * @param   datasetId - Dataset ID
 * @returns {object} Processing status
 */
router.get("/:datasetId/status", getUploadStatus);

export default router;
