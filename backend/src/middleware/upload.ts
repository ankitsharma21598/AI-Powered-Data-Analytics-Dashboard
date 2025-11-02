import multer, { type FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { type Request } from "express";
import { CustomError } from "./errorHandler.js";

// Ensure uploads directory exists
const uploadDir = process.env.UPLOAD_PATH || "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, uploadDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // Generate unique filename: fieldname-timestamp-randomstring.extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, "_");

    cb(null, `${file.fieldname}-${sanitizedName}-${uniqueSuffix}${ext}`);
  },
});

// File filter function
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  // Allowed file extensions
  const allowedExtensions = /csv|json|xlsx|xls/;

  // Check extension
  const ext = path.extname(file.originalname).toLowerCase();
  const extname = allowedExtensions.test(ext.substring(1)); // Remove the dot

  // Allowed MIME types
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
  } else {
    cb(
      new CustomError(
        `Invalid file type. Only CSV, JSON, and Excel files are allowed. Received: ${file.mimetype}`,
        400
      ) as any
    );
  }
};

// Configure multer with storage, limits, and filter
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"), // 10MB default
    files: 1, // Only one file at a time
    fields: 10, // Maximum number of non-file fields
  },
  fileFilter: fileFilter,
});

// Single file upload middleware
export const uploadSingle = upload.single("file");

// Multiple files upload middleware (max 5 files)
export const uploadMultiple = upload.array("files", 5);

// Custom error handler for multer errors
export const handleMulterError = (
  error: any,
  req: Request,
  res: any,
  next: any
) => {
  if (error instanceof multer.MulterError) {
    // Multer-specific errors
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(400).json({
          success: false,
          error: `File too large. Maximum size is ${formatBytes(
            parseInt(process.env.MAX_FILE_SIZE || "10485760")
          )}`,
        });
      case "LIMIT_FILE_COUNT":
        return res.status(400).json({
          success: false,
          error: "Too many files uploaded",
        });
      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          error: "Unexpected field in form data",
        });
      default:
        return res.status(400).json({
          success: false,
          error: `Upload error: ${error.message}`,
        });
    }
  }

  // Pass to next error handler
  next(error);
};

// Validation middleware for file metadata
export const validateFileMetadata = (req: Request, res: any, next: any) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: "No file uploaded",
    });
  }

  // Check if file exists
  if (!fs.existsSync(req.file.path)) {
    return res.status(500).json({
      success: false,
      error: "File upload failed - file not found",
    });
  }

  // Validate file size (double-check after multer)
  const maxSize = parseInt(process.env.MAX_FILE_SIZE || "10485760");
  if (req.file.size > maxSize) {
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);
    return res.status(400).json({
      success: false,
      error: `File size exceeds maximum limit of ${formatBytes(maxSize)}`,
    });
  }

  // Validate file is not empty
  if (req.file.size === 0) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({
      success: false,
      error: "Uploaded file is empty",
    });
  }

  next();
};

// Memory storage for temporary file validation
export const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"),
  },
  fileFilter: fileFilter,
});

// Cleanup middleware - removes file on error
export const cleanupOnError = (req: Request, res: any, next: any) => {
  const originalSend = res.send;
  const originalJson = res.json;

  const cleanup = () => {
    if (req.file && res.statusCode >= 400) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          console.log(`Cleaned up file: ${req.file.path}`);
        }
      } catch (error) {
        console.error("Error cleaning up file:", error);
      }
    }
  };

  res.send = function (data: any) {
    cleanup();
    originalSend.call(this, data);
  };

  res.json = function (data: any) {
    cleanup();
    originalJson.call(this, data);
  };

  next();
};

// File type detector
export const detectFileType = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase();

  switch (ext) {
    case ".csv":
      return "csv";
    case ".json":
      return "json";
    case ".xlsx":
    case ".xls":
      return "excel";
    default:
      return "other";
  }
};

// File validator - checks file integrity
export const validateFileIntegrity = async (
  filePath: string,
  fileType: string
): Promise<{ valid: boolean; error?: string }> => {
  try {
    const stats = fs.statSync(filePath);

    // Check if file exists and has content
    if (!stats.isFile() || stats.size === 0) {
      return { valid: false, error: "File is empty or invalid" };
    }

    // Basic validation based on file type
    switch (fileType) {
      case "csv": {
        const content = fs.readFileSync(filePath, "utf-8");
        if (!content.includes(",") && !content.includes("\t")) {
          return { valid: false, error: "Invalid CSV format" };
        }
        break;
      }
      case "json": {
        const content = fs.readFileSync(filePath, "utf-8");
        try {
          JSON.parse(content);
        } catch {
          return { valid: false, error: "Invalid JSON format" };
        }
        break;
      }
      case "excel": {
        // Basic check for Excel file signature
        const buffer = fs.readFileSync(filePath);
        const signature = buffer.toString("hex", 0, 4);
        // Check for Excel signatures (PK for .xlsx, D0CF for .xls)
        if (!signature.startsWith("504b") && !signature.startsWith("d0cf")) {
          return { valid: false, error: "Invalid Excel format" };
        }
        break;
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "File validation failed",
    };
  }
};

// Get file info
export const getFileInfo = (file: Express.Multer.File) => {
  return {
    originalName: file.originalname,
    filename: file.filename,
    path: file.path,
    size: file.size,
    sizeFormatted: formatBytes(file.size),
    mimetype: file.mimetype,
    extension: path.extname(file.originalname),
    type: detectFileType(file.originalname),
    uploadedAt: new Date(),
  };
};

// Format bytes to human readable
function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Clean up old files (can be used in cron job)
export const cleanupOldFiles = (daysOld: number = 30): void => {
  const uploadPath = process.env.UPLOAD_PATH || "./uploads";

  if (!fs.existsSync(uploadPath)) {
    return;
  }

  const files = fs.readdirSync(uploadPath);
  const now = Date.now();
  const maxAge = daysOld * 24 * 60 * 60 * 1000; // Convert days to milliseconds

  files.forEach((file) => {
    const filePath = path.join(uploadPath, file);
    const stats = fs.statSync(filePath);

    if (now - stats.mtimeMs > maxAge) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up old file: ${file}`);
      } catch (error) {
        console.error(`Error deleting file ${file}:`, error);
      }
    }
  });
};

// Export all utilities
export default {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadMemory,
  handleMulterError,
  validateFileMetadata,
  cleanupOnError,
  detectFileType,
  validateFileIntegrity,
  getFileInfo,
  cleanupOldFiles,
};
