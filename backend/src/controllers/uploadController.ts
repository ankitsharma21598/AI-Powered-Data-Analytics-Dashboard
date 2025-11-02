import { type Response, type NextFunction } from "express";
import Dataset from "../models/Dataset.js";
import { type AuthRequest } from "../middleware/auth.js";
import { CustomError } from "../middleware/errorHandler.js";
import path from "path";
import fs from "fs/promises";
import csv from "csv-parser";
import { createReadStream } from "fs";
import * as XLSX from "xlsx";

// @desc    Upload file and create dataset
// @route   POST /api/upload
// @access  Private
export const uploadFile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      throw new CustomError("Please upload a file", 400);
    }

    const { name, description, tags } = req.body;

    // Determine file type
    const ext = path.extname(req.file.originalname).toLowerCase();
    let fileType: "csv" | "json" | "excel" | "other" = "other";

    if (ext === ".csv") fileType = "csv";
    else if (ext === ".json") fileType = "json";
    else if (ext === ".xlsx" || ext === ".xls") fileType = "excel";

    // Parse tags if provided as string
    let parsedTags: string[] = [];
    if (tags) {
      try {
        parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
      } catch {
        parsedTags = [];
      }
    }

    // Create dataset record
    const dataset = await Dataset.create({
      userId: req.user?._id,
      name: name || req.file.originalname,
      description: description || "",
      fileUrl: `/uploads/${req.file.filename}`,
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
      },
    });

    // Start processing in background
    processFileAsync(dataset?.id.toString(), req.file.path, fileType).catch(
      (error) => console.error("Background processing error:", error)
    );

    res.status(201).json({
      success: true,
      data: dataset,
      message: "File uploaded successfully. Processing will begin shortly.",
    });
  } catch (error) {
    // Clean up uploaded file if dataset creation fails
    if (req.file) {
      await fs.unlink(req.file.path).catch(console.error);
    }
    next(error);
  }
};

// @desc    Process uploaded file (manual trigger)
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

    if (!dataset) {
      throw new CustomError("Dataset not found", 404);
    }

    if (dataset.metadata.processingStatus === "processing") {
      throw new CustomError("Dataset is already being processed", 400);
    }

    // Update processing status
    dataset.metadata.processingStatus = "processing";
    await dataset.save();

    const filePath = path.join(process.cwd(), dataset.fileUrl);

    // Process file in background
    processFileAsync(dataset.id.toString(), filePath, dataset.fileType).catch(
      (error) => console.error("Processing error:", error)
    );

    res.status(200).json({
      success: true,
      message: "File processing started",
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

    if (!dataset) {
      throw new CustomError("Dataset not found", 404);
    }

    res.status(200).json({
      success: true,
      data: {
        name: dataset.name,
        fileName: dataset.fileName,
        fileSize: dataset.fileSize,
        fileType: dataset.fileType,
        status: dataset.metadata.processingStatus,
        errorMessage: dataset.metadata.errorMessage,
        lastModified: dataset.metadata.lastModified,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Validate file before upload
// @route   POST /api/upload/validate
// @access  Private
export const validateFile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      throw new CustomError("Please upload a file", 400);
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const allowedExtensions = [".csv", ".json", ".xlsx", ".xls"];

    if (!allowedExtensions.includes(ext)) {
      // Clean up invalid file
      await fs.unlink(req.file.path);
      throw new CustomError(
        "Invalid file type. Only CSV, JSON, and Excel files are allowed",
        400
      );
    }

    const maxSize = parseInt(process.env.MAX_FILE_SIZE || "10485760"); // 10MB
    if (req.file.size > maxSize) {
      await fs.unlink(req.file.path);
      throw new CustomError(
        `File size exceeds maximum limit of ${formatBytes(maxSize)}`,
        400
      );
    }

    // Quick validation passed
    await fs.unlink(req.file.path); // Clean up validation file

    res.status(200).json({
      success: true,
      message: "File validation passed",
      data: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: ext.substring(1),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Background file processing function
async function processFileAsync(
  datasetId: string,
  filePath: string,
  fileType: string
): Promise<void> {
  try {
    let columns: Array<{ name: string; type: string; nullable: boolean }> = [];
    let rowCount = 0;

    switch (fileType) {
      case "csv":
        ({ columns, rowCount } = await processCSV(filePath));
        break;
      case "json":
        ({ columns, rowCount } = await processJSON(filePath));
        break;
      case "excel":
        ({ columns, rowCount } = await processExcel(filePath));
        break;
      default:
        throw new Error("Unsupported file type");
    }

    // Update dataset with processed data
    await Dataset.findByIdAndUpdate(datasetId, {
      columns,
      rowCount,
      "metadata.processingStatus": "completed",
      "metadata.lastModified": new Date(),
    });
  } catch (error) {
    console.error("File processing error:", error);

    // Update dataset with error status
    await Dataset.findByIdAndUpdate(datasetId, {
      "metadata.processingStatus": "failed",
      "metadata.errorMessage":
        error instanceof Error ? error.message : "Processing failed",
      "metadata.lastModified": new Date(),
    });
  }
}

// Process CSV file
async function processCSV(filePath: string): Promise<{
  columns: Array<{ name: string; type: string; nullable: boolean }>;
  rowCount: number;
}> {
  return new Promise((resolve, reject) => {
    const columns: Map<string, Set<string>> = new Map();
    let rowCount = 0;
    let headers: string[] = [];

    createReadStream(filePath)
      .pipe(csv())
      .on("headers", (headerList: string[]) => {
        headers = headerList;
        headerList.forEach((header) => {
          columns.set(header, new Set());
        });
      })
      .on("data", (row: any) => {
        rowCount++;
        headers.forEach((header) => {
          const value = row[header];
          const type = detectType(value);
          columns.get(header)?.add(type);
        });
      })
      .on("end", () => {
        const columnInfo = Array.from(columns.entries()).map(
          ([name, types]) => ({
            name,
            type: getMostCommonType(Array.from(types)),
            nullable: types.has("null") || types.has("undefined"),
          })
        );

        resolve({ columns: columnInfo, rowCount });
      })
      .on("error", reject);
  });
}

// Process JSON file
async function processJSON(filePath: string): Promise<{
  columns: Array<{ name: string; type: string; nullable: boolean }>;
  rowCount: number;
}> {
  const fileContent = await fs.readFile(filePath, "utf-8");
  const data = JSON.parse(fileContent);

  let rows: any[] = [];

  // Handle different JSON structures
  if (Array.isArray(data)) {
    rows = data;
  } else if (typeof data === "object" && data !== null) {
    // Check if it's an object with an array property
    const arrayKey = Object.keys(data).find((key) => Array.isArray(data[key]));
    if (arrayKey) {
      rows = data[arrayKey];
    } else {
      rows = [data];
    }
  }

  const rowCount = rows.length;
  const columns: Map<string, Set<string>> = new Map();

  // Analyze structure
  rows.forEach((row: any) => {
    if (typeof row === "object" && row !== null) {
      Object.keys(row).forEach((key) => {
        if (!columns.has(key)) {
          columns.set(key, new Set());
        }
        const type = detectType(row[key]);
        columns.get(key)?.add(type);
      });
    }
  });

  const columnInfo = Array.from(columns.entries()).map(([name, types]) => ({
    name,
    type: getMostCommonType(Array.from(types)),
    nullable: types.has("null") || types.has("undefined"),
  }));

  return { columns: columnInfo, rowCount };
}

// Process Excel file
async function processExcel(filePath: string): Promise<{
  columns: Array<{ name: string; type: string; nullable: boolean }>;
  rowCount: number;
}> {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const data: any[] = XLSX.utils.sheet_to_json(worksheet);
  const rowCount = data.length;

  const columns: Map<string, Set<string>> = new Map();

  data.forEach((row: any) => {
    Object.keys(row).forEach((key) => {
      if (!columns.has(key)) {
        columns.set(key, new Set());
      }
      const type = detectType(row[key]);
      columns.get(key)?.add(type);
    });
  });

  const columnInfo = Array.from(columns.entries()).map(([name, types]) => ({
    name,
    type: getMostCommonType(Array.from(types)),
    nullable: types.has("null") || types.has("undefined"),
  }));

  return { columns: columnInfo, rowCount };
}

// Helper: Detect data type
function detectType(value: any): string {
  if (value === null || value === undefined || value === "") {
    return "null";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "float";
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  if (typeof value === "string") {
    // Check if it's a date
    if (!isNaN(Date.parse(value))) {
      return "date";
    }
    // Check if it's a number
    if (!isNaN(Number(value))) {
      return "number";
    }
    return "string";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  if (typeof value === "object") {
    return "object";
  }

  return "unknown";
}

// Helper: Get most common type
function getMostCommonType(types: string[]): string {
  if (types.length === 0) return "unknown";
  if (types.length === 1) return types[0];

  // Remove null from consideration
  const nonNullTypes = types.filter((t) => t !== "null" && t !== "undefined");

  if (nonNullTypes.length === 0) return "null";
  if (nonNullTypes.length === 1) return nonNullTypes[0];

  // Count occurrences
  const counts = new Map<string, number>();
  nonNullTypes.forEach((type) => {
    counts.set(type, (counts.get(type) || 0) + 1);
  });

  // Return most common
  let maxCount = 0;
  let mostCommon = "string";

  counts.forEach((count, type) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = type;
    }
  });

  return mostCommon;
}

// Helper: Format bytes
function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
