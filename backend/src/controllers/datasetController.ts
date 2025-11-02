import { type Response, type NextFunction } from "express";
import Dataset from "../models/Dataset.js";
import Insight from "../models/Insight.js";
import { type AuthRequest } from "../middleware/auth.js";
import { CustomError } from "../middleware/errorHandler.js";
import fs from "fs/promises";
import path from "path";

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

    // TODO: Implement actual file reading and preview
    // For now, return mock data
    const previewData = {
      columns: dataset.columns,
      rows: [
        // Mock rows - replace with actual data reading
        { id: 1, sample: "data" },
        { id: 2, sample: "data" },
      ],
      totalRows: dataset.rowCount,
      previewRows: 10,
    };

    res.status(200).json({
      success: true,
      data: previewData,
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

// Helper function to format bytes
function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
