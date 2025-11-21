import { Response, NextFunction } from "express";
import Dataset from "../models/Dataset.js";
import { AuthRequest } from "../middleware/auth.js";
import { CustomError } from "../middleware/errorHandler.js";
import path from "path";
import csv from "csv-parser";
import { Readable } from "stream";
import * as XLSX from "xlsx";
import {
  uploadBufferToCloudinary,
  downloadToBuffer,
  isCloudinaryConfigured,
} from "../services/cloudinaryService.js";

// Extend AuthRequest to include file with buffer
interface UploadRequest extends AuthRequest {
  file?: Express.Multer.File & { buffer: Buffer };
}

// @desc    Upload file directly to Cloudinary (NO local storage)
// @route   POST /api/upload
// @access  Private
export const uploadFile = async (
  req: UploadRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file || !req.file.buffer) {
      throw new CustomError("Please upload a file", 400);
    }

    if (!isCloudinaryConfigured()) {
      throw new CustomError("Cloud storage is not configured", 500);
    }

    const { name, description, tags } = req.body;

    // Determine file type
    const ext = path.extname(req.file.originalname).toLowerCase();
    let fileType: "csv" | "json" | "excel" | "other" = "other";
    if (ext === ".csv") fileType = "csv";
    else if (ext === ".json") fileType = "json";
    else if (ext === ".xlsx" || ext === ".xls") fileType = "excel";

    if (fileType === "other") {
      throw new CustomError("Invalid file type. Only CSV, JSON, Excel supported.", 400);
    }

    // Parse tags
    let parsedTags: string[] = [];
    if (tags) {
      try {
        parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
      } catch { parsedTags = []; }
    }

    console.log(`📤 Direct upload to Cloudinary: ${req.file.originalname}`);

    // Upload buffer directly to Cloudinary - NO temp file!
    const result = await uploadBufferToCloudinary(
      req.file.buffer,
      req.file.originalname,
      {
        userId: req.user?.id.toString(),
        publicId: `${Date.now()}-${path.parse(req.file.originalname).name}`,
        resourceType: "raw",
        tags: parsedTags,
      }
    );

    console.log(`✅ Uploaded to Cloudinary: ${result.secure_url}`);

    // Create dataset record
    const dataset = await Dataset.create({
      userId: req.user?._id,
      name: name || req.file.originalname,
      description: description || "",
      fileUrl: result.secure_url,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType,
      columns: [],
      rowCount: 0,
      tags: parsedTags,
      metadata: {
        uploadDate: new Date(),
        lastModified: new Date(),
        processingStatus: "pending",
        storageType: "cloudinary",
        cloudPath: result.public_id,
      },
    });

    // Process file in background (from buffer or re-download)
    processFileFromBuffer(
      dataset.id.toString(),
      req.file.buffer,
      fileType
    ).catch(console.error);

    res.status(201).json({
      success: true,
      data: dataset,
      message: "File uploaded directly to cloud. Processing started.",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Process uploaded file
// @route   POST /api/upload/:datasetId/process
// @access  Private
export const processFile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dataset = await Dataset.findOne({
      _id: req.params.datasetId,
      userId: req.user?._id,
    });

    if (!dataset) throw new CustomError("Dataset not found", 404);
    if (dataset.metadata.processingStatus === "processing") {
      throw new CustomError("Already processing", 400);
    }

    dataset.metadata.processingStatus = "processing";
    await dataset.save();

    // Download to buffer and process
    processFileFromUrl(
      dataset.id.toString(),
      dataset.fileUrl,
      dataset.fileType
    ).catch(console.error);

    res.status(200).json({
      success: true,
      message: "Processing started",
      data: dataset,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get upload status
// @route   GET /api/upload/:datasetId/status
// @access  Private
export const getUploadStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dataset = await Dataset.findOne({
      _id: req.params.datasetId,
      userId: req.user?._id,
    }).select("metadata name fileName fileSize fileType");

    if (!dataset) throw new CustomError("Dataset not found", 404);

    res.status(200).json({
      success: true,
      data: {
        name: dataset.name,
        fileName: dataset.fileName,
        fileSize: dataset.fileSize,
        fileType: dataset.fileType,
        status: dataset.metadata.processingStatus,
        errorMessage: dataset.metadata.errorMessage,
        storageType: "cloudinary",
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Validate file
// @route   POST /api/upload/validate
// @access  Private
export const validateFile = async (
  req: UploadRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) throw new CustomError("Please upload a file", 400);

    const ext = path.extname(req.file.originalname).toLowerCase();
    const allowed = [".csv", ".json", ".xlsx", ".xls"];

    if (!allowed.includes(ext)) {
      throw new CustomError("Invalid file type", 400);
    }

    const maxSize = parseInt(process.env.MAX_FILE_SIZE || "10485760");
    if (req.file.size > maxSize) {
      throw new CustomError(`File too large. Max: ${formatBytes(maxSize)}`, 400);
    }

    // No cleanup needed - buffer is in memory only!

    res.status(200).json({
      success: true,
      message: "File validation passed",
      data: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileSizeFormatted: formatBytes(req.file.size),
        fileType: ext.substring(1),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Processing Functions (from buffer - NO disk)
// ============================================

async function processFileFromBuffer(
  datasetId: string,
  buffer: Buffer,
  fileType: string
): Promise<void> {
  try {
    console.log(`📊 Processing file from buffer: ${datasetId}`);

    let columns: Array<{ name: string; type: string; nullable: boolean }> = [];
    let rowCount = 0;

    switch (fileType) {
      case "csv":
        ({ columns, rowCount } = await processCSVBuffer(buffer));
        break;
      case "json":
        ({ columns, rowCount } = processJSONBuffer(buffer));
        break;
      case "excel":
        ({ columns, rowCount } = processExcelBuffer(buffer));
        break;
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    await Dataset.findByIdAndUpdate(datasetId, {
      columns,
      rowCount,
      "metadata.processingStatus": "completed",
      "metadata.lastModified": new Date(),
    });

    console.log(`✅ Processed: ${columns.length} columns, ${rowCount} rows`);
  } catch (error) {
    console.error("❌ Processing failed:", error);
    await Dataset.findByIdAndUpdate(datasetId, {
      "metadata.processingStatus": "failed",
      "metadata.errorMessage": error instanceof Error ? error.message : "Failed",
      "metadata.lastModified": new Date(),
    });
  }
}

async function processFileFromUrl(
  datasetId: string,
  fileUrl: string,
  fileType: string
): Promise<void> {
  try {
    console.log(`📥 Downloading for processing: ${datasetId}`);
    const buffer = await downloadToBuffer(fileUrl);
    await processFileFromBuffer(datasetId, buffer, fileType);
  } catch (error) {
    console.error("❌ Download/processing failed:", error);
    await Dataset.findByIdAndUpdate(datasetId, {
      "metadata.processingStatus": "failed",
      "metadata.errorMessage": error instanceof Error ? error.message : "Failed",
    });
  }
}

// ============================================
// Buffer Processing Functions
// ============================================

async function processCSVBuffer(buffer: Buffer): Promise<{
  columns: Array<{ name: string; type: string; nullable: boolean }>;
  rowCount: number;
}> {
  return new Promise((resolve, reject) => {
    const columns: Map<string, Set<string>> = new Map();
    let rowCount = 0;
    let headers: string[] = [];

    const stream = Readable.from(buffer);
    
    stream
      .pipe(csv())
      .on("headers", (h: string[]) => {
        headers = h;
        h.forEach((header) => columns.set(header, new Set()));
      })
      .on("data", (row: any) => {
        rowCount++;
        headers.forEach((h) => {
          columns.get(h)?.add(detectType(row[h]));
        });
      })
      .on("end", () => {
        const columnInfo = Array.from(columns.entries()).map(([name, types]) => ({
          name,
          type: getMostCommonType(Array.from(types)),
          nullable: types.has("null"),
        }));
        resolve({ columns: columnInfo, rowCount });
      })
      .on("error", reject);
  });
}

function processJSONBuffer(buffer: Buffer): {
  columns: Array<{ name: string; type: string; nullable: boolean }>;
  rowCount: number;
} {
  const data = JSON.parse(buffer.toString("utf-8"));
  let rows: any[] = [];

  if (Array.isArray(data)) {
    rows = data;
  } else if (typeof data === "object" && data !== null) {
    const arrayKey = Object.keys(data).find((k) => Array.isArray(data[k]));
    rows = arrayKey ? data[arrayKey] : [data];
  }

  const columns: Map<string, Set<string>> = new Map();
  rows.forEach((row: any) => {
    if (typeof row === "object" && row !== null) {
      Object.keys(row).forEach((key) => {
        if (!columns.has(key)) columns.set(key, new Set());
        columns.get(key)?.add(detectType(row[key]));
      });
    }
  });

  return {
    columns: Array.from(columns.entries()).map(([name, types]) => ({
      name,
      type: getMostCommonType(Array.from(types)),
      nullable: types.has("null"),
    })),
    rowCount: rows.length,
  };
}

function processExcelBuffer(buffer: Buffer): {
  columns: Array<{ name: string; type: string; nullable: boolean }>;
  rowCount: number;
} {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

  const columns: Map<string, Set<string>> = new Map();
  data.forEach((row: any) => {
    Object.keys(row).forEach((key) => {
      if (!columns.has(key)) columns.set(key, new Set());
      columns.get(key)?.add(detectType(row[key]));
    });
  });

  return {
    columns: Array.from(columns.entries()).map(([name, types]) => ({
      name,
      type: getMostCommonType(Array.from(types)),
      nullable: types.has("null"),
    })),
    rowCount: data.length,
  };
}

// ============================================
// Helpers
// ============================================

function detectType(value: any): string {
  if (value === null || value === undefined || value === "") return "null";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "float";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") {
    if (!isNaN(Date.parse(value))) return "date";
    if (!isNaN(Number(value)) && value.trim() !== "") return "number";
    return "string";
  }
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return "unknown";
}

function getMostCommonType(types: string[]): string {
  if (types.length === 0) return "unknown";
  const nonNull = types.filter((t) => t !== "null");
  if (nonNull.length === 0) return "null";
  if (nonNull.length === 1) return nonNull[0];
  
  const counts = new Map<string, number>();
  nonNull.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1));
  
  let max = 0, result = "string";
  counts.forEach((c, t) => { if (c > max) { max = c; result = t; } });
  return result;
}

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024, dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}