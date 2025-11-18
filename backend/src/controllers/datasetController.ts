import { Response, NextFunction } from "express";
import Dataset from "../models/Dataset.js";
import Insight from "../models/Insight.js";
import { AuthRequest } from "../middleware/auth.js";
import { CustomError } from "../middleware/errorHandler.js";
import fs from "fs/promises";
import path from "path";
import csv from "csv-parser";
import { createReadStream } from "fs";
import * as XLSX from "xlsx";

// @desc    Get all datasets for user
// @route   GET /api/datasets
// @access  Private
export const getDatasets = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Filters
    const filter: any = { userId: req.user?._id };

    if (req.query.fileType) {
      filter.fileType = req.query.fileType;
    }

    if (req.query.processingStatus) {
      filter["metadata.processingStatus"] = req.query.processingStatus;
    }

    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } },
        { tags: { $in: [req.query.search] } },
      ];
    }

    const datasets = await Dataset.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Dataset.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: datasets.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: datasets,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single dataset
// @route   GET /api/datasets/:id
// @access  Private
export const getDataset = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dataset = await Dataset.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!dataset) {
      throw new CustomError("Dataset not found", 404);
    }

    res.status(200).json({
      success: true,
      data: dataset,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update dataset
// @route   PUT /api/datasets/:id
// @access  Private
export const updateDataset = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, description, tags, isPublic } = req.body;

    const dataset = await Dataset.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!dataset) {
      throw new CustomError("Dataset not found", 404);
    }

    // Update fields
    if (name !== undefined) dataset.name = name;
    if (description !== undefined) dataset.description = description;
    if (tags !== undefined) dataset.tags = tags;
    if (isPublic !== undefined) dataset.isPublic = isPublic;

    dataset.metadata.lastModified = new Date();

    await dataset.save();

    res.status(200).json({
      success: true,
      data: dataset,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete dataset and associated file
// @route   DELETE /api/datasets/:id
// @access  Private
export const deleteDataset = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dataset = await Dataset.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!dataset) {
      throw new CustomError("Dataset not found", 404);
    }

    // Delete associated insights
    await Insight.deleteMany({ datasetId: dataset._id });

    // Delete physical file
    try {
      const filePath = path.join(process.cwd(), dataset.fileUrl);

      console.log("File Path ==>", filePath);

      await fs.unlink(filePath);
    } catch (fileError) {
      console.error("Error deleting file:", fileError);
      // Continue even if file deletion fails
    }

    // Delete dataset record
    await dataset.deleteOne();

    res.status(200).json({
      success: true,
      message: "Dataset and associated data deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dataset statistics
// @route   GET /api/datasets/:id/stats
// @access  Private
export const getDatasetStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dataset = await Dataset.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!dataset) {
      throw new CustomError("Dataset not found", 404);
    }

    // Get insights count for this dataset
    const insightsCount = await Insight.countDocuments({
      datasetId: dataset._id,
    });

    // Calculate column statistics
    const columnStats = dataset.columns.map((col) => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable,
      nullCount: 0, // TODO: Calculate from actual data
      uniqueCount: 0, // TODO: Calculate from actual data
    }));

    const stats = {
      basic: {
        fileName: dataset.fileName,
        fileSize: dataset.fileSize,
        fileSizeReadable: formatBytes(dataset.fileSize),
        fileType: dataset.fileType,
        rowCount: dataset.rowCount,
        columnCount: dataset.columns.length,
        uploadDate: dataset.metadata.uploadDate,
        lastModified: dataset.metadata.lastModified,
        processingStatus: dataset.metadata.processingStatus,
      },
      columns: columnStats,
      insights: {
        total: insightsCount,
      },
      tags: dataset.tags,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dataset preview (first N rows)
// @route   GET /api/datasets/:id/preview
// @access  Private
export const getDatasetPreview = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dataset = await Dataset.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!dataset) {
      throw new CustomError("Dataset not found", 404);
    }

    if (dataset.metadata.processingStatus !== "completed") {
      throw new CustomError("Dataset is still being processed", 400);
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const storageType = (dataset.metadata as any).storageType || "local";

    let filePath: string;
    let tempFile = false;
    let localPath: string;

    // Determine file path based on storage type
    if (storageType === "cloudinary") {
      const cloudPath = (dataset.metadata as any).cloudPath;
      if (!cloudPath) {
        throw new CustomError("Cloud path not found for dataset", 500);
      }

      // Download from Cloudinary to temp
      localPath = path.join(
        process.cwd(),
        "temp",
        `preview-${dataset._id}-${Date.now()}${path.extname(dataset.fileName)}`
      );
      await fs.mkdir(path.dirname(localPath), { recursive: true });

      const { downloadFromCloudinary } = await import(
        "../services/cloudinaryService.js"
      );
      await downloadFromCloudinary(dataset.fileUrl, localPath, "raw");
      tempFile = true;
    } else {
      // Local storage
      localPath = path.join(process.cwd(), dataset.fileUrl);
    }

    // Read and parse file based on type
    let previewData: any;

    switch (dataset.fileType) {
      case "csv":
        previewData = await readCSVPreview(localPath, limit);
        break;
      case "json":
        previewData = await readJSONPreview(localPath, limit);
        break;
      case "excel":
        previewData = await readExcelPreview(localPath, limit);
        break;
      default:
        throw new CustomError("Unsupported file type for preview", 400);
    }

    // Cleanup temp file
    if (tempFile) {
      await fs.unlink(localPath).catch(console.error);
    }

    res.status(200).json({
      success: true,
      data: {
        columns: dataset.columns,
        rows: previewData,
        totalRows: dataset.rowCount,
        previewRows: previewData.length,
        fileType: dataset.fileType,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Download dataset
// @route   GET /api/datasets/:id/download
// @access  Private
export const downloadDataset = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dataset = await Dataset.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!dataset) {
      throw new CustomError("Dataset not found", 404);
    }

    const filePath = path.join(process.cwd(), dataset.fileUrl);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      throw new CustomError("File not found", 404);
    }

    res.download(filePath, dataset.fileName);
  } catch (error) {
    next(error);
  }
};

// @desc    Duplicate dataset
// @route   POST /api/datasets/:id/duplicate
// @access  Private
export const duplicateDataset = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const originalDataset = await Dataset.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!originalDataset) {
      throw new CustomError("Dataset not found", 404);
    }

    // Create duplicate
    const duplicate = await Dataset.create({
      userId: req.user?._id,
      name: `${originalDataset.name} (Copy)`,
      description: originalDataset.description,
      fileUrl: originalDataset.fileUrl, // Same file
      fileName: originalDataset.fileName,
      fileSize: originalDataset.fileSize,
      fileType: originalDataset.fileType,
      columns: originalDataset.columns,
      rowCount: originalDataset.rowCount,
      tags: originalDataset.tags,
      metadata: {
        uploadDate: new Date(),
        lastModified: new Date(),
        processingStatus: originalDataset.metadata.processingStatus,
      },
    });

    res.status(201).json({
      success: true,
      data: duplicate,
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to format bytes to human readable
function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Helper function to read CSV preview
async function readCSVPreview(filePath: string, limit: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const rows: any[] = [];
    let count = 0;

    createReadStream(filePath)
      .pipe(csv())
      .on("data", (row: any) => {
        if (count < limit) {
          rows.push(row);
          count++;
        }
      })
      .on("end", () => {
        resolve(rows);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

// Helper function to read JSON preview
async function readJSONPreview(
  filePath: string,
  limit: number
): Promise<any[]> {
  try {
    const fileContent = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(fileContent);

    let rows: any[] = [];

    // Handle different JSON structures
    if (Array.isArray(data)) {
      rows = data;
    } else if (typeof data === "object" && data !== null) {
      const arrayKey = Object.keys(data).find((key) =>
        Array.isArray(data[key])
      );
      if (arrayKey) {
        rows = data[arrayKey];
      } else {
        rows = [data];
      }
    }

    // Return limited rows
    return rows.slice(0, limit);
  } catch (error) {
    throw new Error(`Failed to read JSON file: ${error}`);
  }
}

// Helper function to read Excel preview
async function readExcelPreview(
  filePath: string,
  limit: number
): Promise<any[]> {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);

    // Return limited rows
    return data.slice(0, limit);
  } catch (error) {
    throw new Error(`Failed to read Excel file: ${error}`);
  }
}
