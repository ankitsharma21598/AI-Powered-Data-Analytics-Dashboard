import { Response, NextFunction } from "express";
import Dataset from "../models/Dataset.js";
import Insight from "../models/Insight.js";
import { AuthRequest } from "../middleware/auth.js";
import { CustomError } from "../middleware/errorHandler.js";
import csv from "csv-parser";
import { Readable } from "stream";
import * as XLSX from "xlsx";
import {
  downloadToBuffer,
  deleteFromCloudinary,
} from "../services/cloudinaryService.js";

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

    const filter: any = { userId: req.user?._id };
    if (req.query.fileType) filter.fileType = req.query.fileType;
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

    if (!dataset) throw new CustomError("Dataset not found", 404);

    res.status(200).json({ success: true, data: dataset });
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

    if (!dataset) throw new CustomError("Dataset not found", 404);

    if (name !== undefined) dataset.name = name;
    if (description !== undefined) dataset.description = description;
    if (tags !== undefined) dataset.tags = tags;
    if (isPublic !== undefined) dataset.isPublic = isPublic;
    dataset.metadata.lastModified = new Date();

    await dataset.save();
    res.status(200).json({ success: true, data: dataset });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete dataset and Cloudinary file
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

    if (!dataset) throw new CustomError("Dataset not found", 404);

    // Delete associated insights
    await Insight.deleteMany({ datasetId: dataset._id });

    // Delete from Cloudinary
    const cloudPath = (dataset.metadata as any).cloudPath;
    if (cloudPath) {
      try {
        await deleteFromCloudinary(cloudPath, "raw");
        console.log(`✅ Deleted from Cloudinary: ${cloudPath}`);
      } catch (err) {
        console.error("Error deleting from Cloudinary:", err);
      }
    }

    await dataset.deleteOne();

    res.status(200).json({
      success: true,
      message: "Dataset deleted successfully",
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

    if (!dataset) throw new CustomError("Dataset not found", 404);

    const insightsCount = await Insight.countDocuments({ datasetId: dataset._id });

    res.status(200).json({
      success: true,
      data: {
        basic: {
          fileName: dataset.fileName,
          fileSize: dataset.fileSize,
          fileSizeReadable: formatBytes(dataset.fileSize),
          fileType: dataset.fileType,
          rowCount: dataset.rowCount,
          columnCount: dataset.columns.length,
          uploadDate: dataset.metadata.uploadDate,
          processingStatus: dataset.metadata.processingStatus,
          storageType: "cloudinary",
        },
        columns: dataset.columns,
        insights: { total: insightsCount },
        tags: dataset.tags,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dataset preview (NO local storage)
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

    if (!dataset) throw new CustomError("Dataset not found", 404);
    if (dataset.metadata.processingStatus !== "completed") {
      throw new CustomError("Dataset is still being processed", 400);
    }

    const limit = parseInt(req.query.limit as string) || 10;

    // Download to buffer (NO local file)
    console.log(`📥 Fetching preview from Cloudinary...`);
    const buffer = await downloadToBuffer(dataset.fileUrl);

    let previewData: any[] = [];

    switch (dataset.fileType) {
      case "csv":
        previewData = await readCSVPreviewFromBuffer(buffer, limit);
        break;
      case "json":
        previewData = readJSONPreviewFromBuffer(buffer, limit);
        break;
      case "excel":
        previewData = readExcelPreviewFromBuffer(buffer, limit);
        break;
      default:
        throw new CustomError("Unsupported file type for preview", 400);
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

// @desc    Download dataset (redirect to Cloudinary URL)
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

    if (!dataset) throw new CustomError("Dataset not found", 404);

    // Redirect to Cloudinary URL for download
    res.redirect(dataset.fileUrl);
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
    const original = await Dataset.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!original) throw new CustomError("Dataset not found", 404);

    const duplicate = await Dataset.create({
      userId: req.user?._id,
      name: `${original.name} (Copy)`,
      description: original.description,
      fileUrl: original.fileUrl, // Same Cloudinary URL
      fileName: original.fileName,
      fileSize: original.fileSize,
      fileType: original.fileType,
      columns: original.columns,
      rowCount: original.rowCount,
      tags: original.tags,
      metadata: {
        uploadDate: new Date(),
        lastModified: new Date(),
        processingStatus: original.metadata.processingStatus,
        storageType: "cloudinary",
        cloudPath: (original.metadata as any).cloudPath,
      },
    });

    res.status(201).json({ success: true, data: duplicate });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Buffer Preview Functions (NO local storage)
// ============================================

async function readCSVPreviewFromBuffer(buffer: Buffer, limit: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const rows: any[] = [];
    let count = 0;

    Readable.from(buffer)
      .pipe(csv())
      .on("data", (row: any) => {
        if (count < limit) { rows.push(row); count++; }
      })
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

function readJSONPreviewFromBuffer(buffer: Buffer, limit: number): any[] {
  const data = JSON.parse(buffer.toString("utf-8"));
  let rows: any[] = [];

  if (Array.isArray(data)) {
    rows = data;
  } else if (typeof data === "object" && data !== null) {
    const arrayKey = Object.keys(data).find((k) => Array.isArray(data[k]));
    rows = arrayKey ? data[arrayKey] : [data];
  }

  return rows.slice(0, limit);
}

function readExcelPreviewFromBuffer(buffer: Buffer, limit: number): any[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  return data.slice(0, limit);
}

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024, dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}