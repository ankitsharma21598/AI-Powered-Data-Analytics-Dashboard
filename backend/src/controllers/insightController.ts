import { type Response, type NextFunction } from "express";
import Insight from "../models/Insight.js";
import Dataset from "../models/Dataset.js";
import { type AuthRequest } from "../middleware/auth.js";
import { CustomError } from "../middleware/errorHandler.js";
import { OpenAI } from "openai";

import dotenv from "dotenv";
dotenv.config();

// @desc    Get all insights for user
// @route   GET /api/insights
// @access  Private
export const getInsights = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = { userId: req.user?._id };

    if (req.query.datasetId) {
      filter.datasetId = req.query.datasetId;
    }

    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.aiGenerated !== undefined) {
      filter.aiGenerated = req.query.aiGenerated === "true";
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const insights = await Insight.find(filter)
      .populate("datasetId", "name fileType rowCount")
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Insight.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: insights.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: insights,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single insight
// @route   GET /api/insights/:id
// @access  Private
export const getInsight = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const insight = await Insight.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    })
      .populate("datasetId", "name fileType columns rowCount")
      .populate("userId", "name email avatar");

    if (!insight) {
      throw new CustomError("Insight not found", 404);
    }

    // Increment view count
    await insight.incrementViewCount();

    res.status(200).json({
      success: true,
      data: insight,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new insight
// @route   POST /api/insights
// @access  Private
export const createInsight = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      datasetId,
      title,
      description,
      type,
      visualizations,
      metrics,
      recommendations,
      status,
      tags,
    } = req.body;

    // Validate required fields
    if (!datasetId || !title || !description || !type) {
      throw new CustomError(
        "Please provide datasetId, title, description, and type",
        400
      );
    }

    // Verify dataset exists and belongs to user
    const dataset = await Dataset.findOne({
      _id: datasetId,
      userId: req.user?._id,
    });

    if (!dataset) {
      throw new CustomError("Dataset not found", 404);
    }

    // Create insight
    const insight = await Insight.create({
      userId: req.user?._id,
      datasetId,
      title,
      description,
      type,
      visualizations: visualizations || [],
      metrics: metrics || [],
      recommendations: recommendations || [],
      status: status || "published",
      tags: tags || [],
      aiGenerated: false,
      confidence: 0,
    });

    // Populate dataset info
    await insight.populate("datasetId", "name fileType");

    res.status(201).json({
      success: true,
      data: insight,
      message: "Insight created successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate AI insight
// @route   POST /api/insights/generate
// @access  Private
// export const generateAIInsight = async (
//   req: AuthRequest,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const { datasetId, query, type } = req.body;

//     if (!datasetId) {
//       throw new CustomError("Please provide a dataset ID", 400);
//     }

//     // Verify dataset exists and belongs to user
//     const dataset = await Dataset.findOne({
//       _id: datasetId,
//       userId: req.user?._id,
//     });

//     if (!dataset) {
//       throw new CustomError("Dataset not found", 404);
//     }

//     if (dataset.metadata.processingStatus !== "completed") {
//       throw new CustomError(
//         "Dataset must be fully processed before generating insights",
//         400
//       );
//     }

//     // TODO: Integrate with actual AI service (OpenAI, Claude, etc.)
//     // For now, generate mock AI insight
//     const insightType = type || "summary";
//     const aiInsight = generateMockAIInsight(dataset, query, insightType);

//     const insight = await Insight.create({
//       userId: req.user?._id,
//       datasetId,
//       title: aiInsight.title,
//       description: aiInsight.description,
//       type: insightType,
//       aiGenerated: true,
//       confidence: aiInsight.confidence,
//       query: query || "",
//       aiModel: "gpt-4", // Placeholder
//       visualizations: aiInsight.visualizations,
//       metrics: aiInsight.metrics,
//       recommendations: aiInsight.recommendations,
//       status: "published",
//     });

//     await insight.populate("datasetId", "name fileType");

//     res.status(201).json({
//       success: true,
//       data: insight,
//       message: "AI insight generated successfully",
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AIInsightResult {
  title: string;
  description: string;
  confidence: number;
  visualizations: Array<{
    type: string;
    data: any;
    config: any;
  }>;
  metrics: Array<{
    name: string;
    value: number | string;
    trend?: string;
  }>;
  recommendations: string[];
}

const generateAIInsightWithOpenAI = async (
  dataset: any,
  query: string,
  insightType: string
): Promise<AIInsightResult> => {
  try {
    // Prepare dataset context for OpenAI
    const datasetContext = {
      name: dataset.name,
      fileType: dataset.fileType,
      rowCount: dataset.metadata.rowCount,
      columns: dataset.metadata.columns,
      summary: dataset.metadata.summary,
      // Include sample data if available (limit to avoid token limits)
      sampleData: dataset.sampleData?.slice(0, 10),
    };

    // Create a detailed prompt based on insight type
    const systemPrompt = `You are a data analysis expert. Analyze the provided dataset and generate actionable insights. 
Return your response as a valid JSON object with the following structure:
{
  "title": "Brief, descriptive title for the insight",
  "description": "Detailed analysis and findings (2-3 paragraphs)",
  "confidence": 0.85,
  "visualizations": [
    {
      "type": "bar|line|pie|scatter",
      "data": { ... },
      "config": { "xAxis": "...", "yAxis": "...", "title": "..." }
    }
  ],
  "metrics": [
    {
      "name": "Metric name",
      "value": "value or number",
      "trend": "up|down|stable"
    }
  ],
  "recommendations": ["Actionable recommendation 1", "Actionable recommendation 2"]
}`;

    const userPrompt = `Dataset Information:
${JSON.stringify(datasetContext, null, 2)}

Insight Type: ${insightType}
${query ? `Specific Query: ${query}` : ""}

Please analyze this dataset and provide:
1. Key patterns and trends
2. Statistical insights
3. Anomalies or outliers
4. Correlations between variables
5. Actionable recommendations

Focus on providing specific, data-driven insights with concrete metrics.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No response from OpenAI");
    }

    const aiInsight: AIInsightResult = JSON.parse(responseContent);

    // Validate and set defaults
    return {
      title: aiInsight.title || "AI-Generated Insight",
      description: aiInsight.description || "No description available",
      confidence: Math.min(Math.max(aiInsight.confidence || 0.7, 0), 1),
      visualizations: aiInsight.visualizations || [],
      metrics: aiInsight.metrics || [],
      recommendations: aiInsight.recommendations || [],
    };
  } catch (error: any) {
    console.error("OpenAI API Error:", error);
    throw new CustomError(
      `Failed to generate AI insight: ${error.message}`,
      500
    );
  }
};

export const generateAIInsight = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { datasetId, query, type } = req.body;

    if (!datasetId) {
      throw new CustomError("Please provide a dataset ID", 400);
    }

    // Verify dataset exists and belongs to user
    const dataset = await Dataset.findOne({
      _id: datasetId,
      userId: req.user?._id,
    });

    if (!dataset) {
      throw new CustomError("Dataset not found", 404);
    }

    if (dataset.metadata.processingStatus !== "completed") {
      throw new CustomError(
        "Dataset must be fully processed before generating insights",
        400
      );
    }

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      throw new CustomError(
        "OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.",
        500
      );
    }

    const insightType = type || "summary";

    // Generate AI insight using OpenAI
    const aiInsight = await generateAIInsightWithOpenAI(
      dataset,
      query,
      insightType
    );

    // Create insight record
    const insight = await Insight.create({
      userId: req.user?._id,
      datasetId,
      title: aiInsight.title,
      description: aiInsight.description,
      type: insightType,
      aiGenerated: true,
      confidence: aiInsight.confidence,
      query: query || "",
      aiModel: "gpt-4o-mini",
      visualizations: aiInsight.visualizations,
      metrics: aiInsight.metrics,
      recommendations: aiInsight.recommendations,
      status: "published",
    });

    await insight.populate("datasetId", "name fileType");

    res.status(201).json({
      success: true,
      data: insight,
      message: "AI insight generated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update insight
// @route   PUT /api/insights/:id
// @access  Private
export const updateInsight = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      title,
      description,
      type,
      visualizations,
      metrics,
      recommendations,
      status,
      tags,
    } = req.body;

    const insight = await Insight.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!insight) {
      throw new CustomError("Insight not found", 404);
    }

    // Update fields
    if (title !== undefined) insight.title = title;
    if (description !== undefined) insight.description = description;
    if (type !== undefined) insight.type = type;
    if (visualizations !== undefined) insight.visualizations = visualizations;
    if (metrics !== undefined) insight.metrics = metrics;
    if (recommendations !== undefined)
      insight.recommendations = recommendations;
    if (status !== undefined) insight.status = status;
    if (tags !== undefined) insight.tags = tags;

    await insight.save();
    await insight.populate("datasetId", "name fileType");

    res.status(200).json({
      success: true,
      data: insight,
      message: "Insight updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete insight
// @route   DELETE /api/insights/:id
// @access  Private
export const deleteInsight = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const insight = await Insight.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!insight) {
      throw new CustomError("Insight not found", 404);
    }

    await insight.deleteOne();

    res.status(200).json({
      success: true,
      message: "Insight deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Duplicate insight
// @route   POST /api/insights/:id/duplicate
// @access  Private
export const duplicateInsight = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const originalInsight = await Insight.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!originalInsight) {
      throw new CustomError("Insight not found", 404);
    }

    const duplicate = await Insight.create({
      userId: req.user?._id,
      datasetId: originalInsight.datasetId,
      title: `${originalInsight.title} (Copy)`,
      description: originalInsight.description,
      type: originalInsight.type,
      aiGenerated: originalInsight.aiGenerated,
      confidence: originalInsight.confidence,
      visualizations: originalInsight.visualizations,
      metrics: originalInsight.metrics,
      recommendations: originalInsight.recommendations,
      query: originalInsight.query,
      aiModel: originalInsight.aiModel,
      tags: originalInsight.tags,
      status: "draft",
    });

    await duplicate.populate("datasetId", "name fileType");

    res.status(201).json({
      success: true,
      data: duplicate,
      message: "Insight duplicated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get insights by dataset
// @route   GET /api/insights/dataset/:datasetId
// @access  Private
export const getInsightsByDataset = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Verify dataset belongs to user
    const dataset = await Dataset.findOne({
      _id: req.params.datasetId,
      userId: req.user?._id,
    });

    if (!dataset) {
      throw new CustomError("Dataset not found", 404);
    }

    const insights = await Insight.find({
      datasetId: req.params.datasetId,
      userId: req.user?._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: insights.length,
      data: insights,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get insight statistics
// @route   GET /api/insights/stats
// @access  Private
export const getInsightStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const totalInsights = await Insight.countDocuments({
      userId: req.user?._id,
    });

    const aiGeneratedCount = await Insight.countDocuments({
      userId: req.user?._id,
      aiGenerated: true,
    });

    const insightsByType = await Insight.aggregate([
      { $match: { userId: req.user?._id } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const insightsByStatus = await Insight.aggregate([
      { $match: { userId: req.user?._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const avgConfidence = await Insight.aggregate([
      { $match: { userId: req.user?._id, aiGenerated: true } },
      { $group: { _id: null, avgConfidence: { $avg: "$confidence" } } },
    ]);

    const recentInsights = await Insight.find({
      userId: req.user?._id,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("datasetId", "name")
      .lean();

    const topViewed = await Insight.find({
      userId: req.user?._id,
    })
      .sort({ viewCount: -1 })
      .limit(5)
      .select("title viewCount type")
      .lean();

    res.status(200).json({
      success: true,
      data: {
        total: totalInsights,
        aiGenerated: aiGeneratedCount,
        manuallyCreated: totalInsights - aiGeneratedCount,
        byType: insightsByType,
        byStatus: insightsByStatus,
        avgConfidence: avgConfidence[0]?.avgConfidence || 0,
        recent: recentInsights,
        topViewed: topViewed,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Share insight with users
// @route   POST /api/insights/:id/share
// @access  Private
export const shareInsight = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw new CustomError("Please provide an array of user IDs", 400);
    }

    const insight = await Insight.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!insight) {
      throw new CustomError("Insight not found", 404);
    }

    await insight.shareWith(userIds);

    res.status(200).json({
      success: true,
      data: insight,
      message: "Insight shared successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unshare insight from user
// @route   DELETE /api/insights/:id/share/:userId
// @access  Private
export const unshareInsight = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const insight = await Insight.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!insight) {
      throw new CustomError("Insight not found", 404);
    }

    await insight.unshareWith(req.params.userId as any);

    res.status(200).json({
      success: true,
      data: insight,
      message: "Insight unshared successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Publish insight (change status to published)
// @route   PATCH /api/insights/:id/publish
// @access  Private
export const publishInsight = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const insight = await Insight.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!insight) {
      throw new CustomError("Insight not found", 404);
    }

    await insight.publish();

    res.status(200).json({
      success: true,
      data: insight,
      message: "Insight published successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Archive insight
// @route   PATCH /api/insights/:id/archive
// @access  Private
export const archiveInsight = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const insight = await Insight.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!insight) {
      throw new CustomError("Insight not found", 404);
    }

    await insight.archive();

    res.status(200).json({
      success: true,
      data: insight,
      message: "Insight archived successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to generate mock AI insights
function generateMockAIInsight(dataset: any, query: string, type: string) {
  const insights: any = {
    trend: {
      title: `Trend Analysis: ${dataset.name}`,
      description: `Analysis shows clear patterns in the data over time. The dataset contains ${dataset.rowCount} rows across ${dataset.columns.length} columns, with significant trends identified in key metrics.`,
      confidence: 87,
      visualizations: [
        {
          type: "line",
          data: {
            labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
            datasets: [
              {
                label: "Trend",
                data: [65, 72, 78, 85],
                borderColor: "rgb(75, 192, 192)",
                tension: 0.1,
              },
            ],
          },
          config: { responsive: true, maintainAspectRatio: false },
        },
      ],
      metrics: [
        { name: "Growth Rate", value: "15.4%", unit: "percentage" },
        { name: "Average Value", value: 75, unit: "units" },
        { name: "Trend Strength", value: "Strong", unit: "categorical" },
      ],
      recommendations: [
        "Continue monitoring the upward trend",
        "Consider seasonal adjustments in analysis",
        "Investigate potential outliers for deeper insights",
        "Set up alerts for significant deviations",
      ],
    },
    correlation: {
      title: `Correlation Analysis: ${dataset.name}`,
      description: `Strong correlations discovered between multiple variables in the dataset. Analysis of ${dataset.rowCount} records reveals meaningful relationships that can drive decision-making.`,
      confidence: 92,
      visualizations: [
        {
          type: "scatter",
          data: {
            datasets: [
              {
                label: "Correlation",
                data: [
                  { x: 10, y: 15 },
                  { x: 20, y: 25 },
                  { x: 30, y: 35 },
                  { x: 40, y: 45 },
                ],
                backgroundColor: "rgba(255, 99, 132, 0.5)",
              },
            ],
          },
          config: {},
        },
      ],
      metrics: [
        { name: "Correlation Coefficient", value: "0.89", unit: "coefficient" },
        { name: "P-Value", value: "< 0.001", unit: "statistical" },
        { name: "R-Squared", value: "0.79", unit: "coefficient" },
      ],
      recommendations: [
        "Leverage this correlation for predictive modeling",
        "Verify causation with domain experts",
        "Monitor correlation stability over time",
        "Use insights to optimize related processes",
      ],
    },
    anomaly: {
      title: `Anomaly Detection: ${dataset.name}`,
      description: `Identified ${
        Math.floor(Math.random() * 10) + 1
      } anomalies in the dataset. These outliers may represent data quality issues, special events, or opportunities for investigation.`,
      confidence: 78,
      visualizations: [
        {
          type: "scatter",
          data: {
            datasets: [
              {
                label: "Normal",
                data: Array.from({ length: 50 }, () => ({
                  x: Math.random() * 100,
                  y: Math.random() * 100,
                })),
                backgroundColor: "rgba(75, 192, 192, 0.5)",
              },
              {
                label: "Anomalies",
                data: Array.from({ length: 5 }, () => ({
                  x: Math.random() * 100 + 50,
                  y: Math.random() * 100 + 50,
                })),
                backgroundColor: "rgba(255, 99, 132, 1)",
              },
            ],
          },
          config: {},
        },
      ],
      metrics: [
        { name: "Anomalies Found", value: 7, unit: "count" },
        { name: "Severity Score", value: "Medium", unit: "categorical" },
        { name: "Detection Rate", value: "95%", unit: "percentage" },
      ],
      recommendations: [
        "Investigate identified anomalies for root causes",
        "Consider data quality checks at source",
        "Set up automated anomaly detection",
        "Document and track anomaly patterns",
      ],
    },
    prediction: {
      title: `Predictive Analysis: ${dataset.name}`,
      description: `Based on historical patterns in ${dataset.rowCount} records, the model predicts future trends with high confidence. Predictions are based on multiple features across ${dataset.columns.length} dimensions.`,
      confidence: 84,
      visualizations: [
        {
          type: "line",
          data: {
            labels: ["Current", "Month +1", "Month +2", "Month +3", "Month +4"],
            datasets: [
              {
                label: "Historical",
                data: [100, 110, 115, 120, null],
                borderColor: "rgb(75, 192, 192)",
              },
              {
                label: "Predicted",
                data: [null, null, null, 120, 128, 136, 145],
                borderColor: "rgb(255, 99, 132)",
                borderDash: [5, 5],
              },
            ],
          },
          config: {},
        },
      ],
      metrics: [
        { name: "Predicted Growth", value: "20%", unit: "percentage" },
        { name: "Confidence Interval", value: "±5%", unit: "percentage" },
        { name: "Model Accuracy", value: "89%", unit: "percentage" },
      ],
      recommendations: [
        "Use predictions for resource planning",
        "Regularly update model with new data",
        "Monitor prediction accuracy over time",
        "Consider ensemble methods for better accuracy",
      ],
    },
    summary: {
      title: `Data Summary: ${dataset.name}`,
      description: `Comprehensive overview of ${dataset.name} showing key statistics and patterns across all ${dataset.columns.length} columns and ${dataset.rowCount} rows.`,
      confidence: 94,
      visualizations: [
        {
          type: "bar",
          data: {
            labels: dataset.columns.map((col: any) => col.name).slice(0, 5),
            datasets: [
              {
                label: "Distribution",
                data: [65, 59, 80, 81, 56],
                backgroundColor: [
                  "rgba(255, 99, 132, 0.5)",
                  "rgba(54, 162, 235, 0.5)",
                  "rgba(255, 206, 86, 0.5)",
                  "rgba(75, 192, 192, 0.5)",
                  "rgba(153, 102, 255, 0.5)",
                ],
              },
            ],
          },
          config: {},
        },
      ],
      metrics: [
        { name: "Total Records", value: dataset.rowCount, unit: "rows" },
        { name: "Columns", value: dataset.columns.length, unit: "fields" },
        { name: "Data Quality", value: "96%", unit: "percentage" },
        { name: "Completeness", value: "94%", unit: "percentage" },
      ],
      recommendations: [
        "Data quality is excellent for analysis",
        "All columns are properly formatted",
        "Ready for advanced analytics",
        "Consider creating additional derived metrics",
      ],
    },
    custom: {
      title: `Custom Analysis: ${dataset.name}`,
      description:
        query ||
        `Custom analysis performed on ${dataset.name}. Analysis tailored to specific requirements with ${dataset.rowCount} data points.`,
      confidence: 75,
      visualizations: [
        {
          type: "pie",
          data: {
            labels: ["Category A", "Category B", "Category C", "Category D"],
            datasets: [
              {
                data: [30, 25, 25, 20],
                backgroundColor: [
                  "rgba(255, 99, 132, 0.8)",
                  "rgba(54, 162, 235, 0.8)",
                  "rgba(255, 206, 86, 0.8)",
                  "rgba(75, 192, 192, 0.8)",
                ],
              },
            ],
          },
          config: {},
        },
      ],
      metrics: [
        { name: "Primary Metric", value: 85, unit: "score" },
        { name: "Secondary Metric", value: "72%", unit: "percentage" },
        { name: "Analysis Depth", value: "High", unit: "categorical" },
      ],
      recommendations: [
        "Review custom analysis parameters",
        "Validate findings with domain experts",
        "Consider automated reporting for similar analyses",
        "Document methodology for reproducibility",
      ],
    },
  };

  return insights[type] || insights.summary;
}
