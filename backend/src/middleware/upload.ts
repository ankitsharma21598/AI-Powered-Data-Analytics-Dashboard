import multer, { type FileFilterCallback } from "multer";
import path from "path";
import { type Request } from "express";
import { CustomError } from "./errorHandler.js";

// Use MEMORY storage - no disk writes at all
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  const allowedExtensions = /csv|json|xlsx|xls/;
  const ext = path.extname(file.originalname).toLowerCase();
  const extname = allowedExtensions.test(ext.substring(1));

  const allowedMimeTypes = [
    "text/csv",
    "application/csv",
    "application/json",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  const mimetype = allowedMimeTypes.includes(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  }
  
  cb(new CustomError(
    `Invalid file type. Only CSV, JSON, and Excel files are allowed. Received: ${file.mimetype}`,
    400
  ) as any);
};

// Configure multer with MEMORY storage
export const upload = multer({
  storage: storage, // Memory storage - no temp files
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"), // 10MB
    files: 1,
    fields: 10,
  },
  fileFilter: fileFilter,
});

// Single file upload middleware
export const uploadSingle = upload.single("file");

// Multiple files upload middleware
export const uploadMultiple = upload.array("files", 5);

// Custom error handler for multer errors
export const handleMulterError = (error: any, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(400).json({
          success: false,
          error: `File too large. Maximum size is ${formatBytes(
            parseInt(process.env.MAX_FILE_SIZE || "10485760")
          )}`,
        });
      case "LIMIT_FILE_COUNT":
        return res.status(400).json({ success: false, error: "Too many files" });
      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({ success: false, error: "Unexpected field" });
      default:
        return res.status(400).json({ success: false, error: `Upload error: ${error.message}` });
    }
  }
  next(error);
};

// Validate file from memory buffer
export const validateFileMetadata = (req: Request, res: any, next: any) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No file uploaded" });
  }

  // File is in memory as req.file.buffer
  if (!req.file.buffer || req.file.buffer.length === 0) {
    return res.status(400).json({ success: false, error: "Uploaded file is empty" });
  }

  const maxSize = parseInt(process.env.MAX_FILE_SIZE || "10485760");
  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      error: `File size exceeds maximum limit of ${formatBytes(maxSize)}`,
    });
  }

  next();
};

// File type detector
export const detectFileType = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".csv": return "csv";
    case ".json": return "json";
    case ".xlsx":
    case ".xls": return "excel";
    default: return "other";
  }
};

function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// No cleanup needed - memory is automatically garbage collected!
export const cleanupOnError = (req: Request, res: any, next: any) => next();

export default {
  upload,
  uploadSingle,
  uploadMultiple,
  handleMulterError,
  validateFileMetadata,
  cleanupOnError,
  detectFileType,
};