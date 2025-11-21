import mongoose, { Document, Schema } from "mongoose";

export interface IInsight extends Document {
  userId: mongoose.Types.ObjectId;
  datasetId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  type:
    | "trend"
    | "anomaly"
    | "correlation"
    | "prediction"
    | "summary"
    | "custom";
  aiGenerated: boolean;
  confidence: number;
  visualizations: Array<{
    type: "line" | "bar" | "pie" | "scatter" | "heatmap" | "table";
    data: any;
    config: any;
  }>;
  metrics: Array<{
    name: string;
    value: number | string;
    unit?: string;
  }>;
  recommendations: string[];
  query?: string;
  aiModel?: string;
  status: "draft" | "published" | "archived";
  tags: string[];
  sharedWith: mongoose.Types.ObjectId[];
  viewCount: number;
  lastViewed?: Date;
  createdAt: Date;
  updatedAt: Date;
  incrementViewCount(): Promise<IInsight>;
  publish(): Promise<IInsight>;
  archive(): Promise<IInsight>;
  shareWith(userIds: mongoose.Types.ObjectId[]): Promise<IInsight>;
  unshareWith(userId: mongoose.Types.ObjectId): Promise<IInsight>;
  isSharedWith(userId: mongoose.Types.ObjectId): boolean;
}

const insightSchema = new Schema<IInsight>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    datasetId: {
      type: Schema.Types.ObjectId,
      ref: "Dataset",
      required: [true, "Dataset ID is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Please provide a title for the insight"],
      trim: true,
      maxlength: [150, "Title cannot be more than 150 characters"],
    },
    description: {
      type: String,
      required: [true, "Please provide a description"],
      trim: true,
      maxlength: [2000, "Description cannot be more than 2000 characters"],
    },
    type: {
      type: String,
      enum: {
        values: [
          "trend",
          "anomaly",
          "correlation",
          "prediction",
          "summary",
          "custom",
        ],
        message: "{VALUE} is not a valid insight type",
      },
      required: [true, "Insight type is required"],
    },
    aiGenerated: {
      type: Boolean,
      default: false,
    },
    confidence: {
      type: Number,
      min: [0, "Confidence must be at least 0"],
      max: [100, "Confidence cannot exceed 100"],
      default: 0,
    },
    visualizations: [
      {
        type: {
          type: String,
          enum: ["line", "bar", "pie", "scatter", "heatmap", "table"],
          required: true,
        },
        data: {
          type: Schema.Types.Mixed,
          required: true,
        },
        config: {
          type: Schema.Types.Mixed,
          default: {},
        },
      },
    ],
    metrics: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        value: {
          type: Schema.Types.Mixed,
          required: true,
        },
        unit: {
          type: String,
          trim: true,
        },
      },
    ],
    recommendations: [
      {
        type: String,
        trim: true,
        maxlength: [500, "Each recommendation cannot exceed 500 characters"],
      },
    ],
    query: {
      type: String,
      trim: true,
      maxlength: [1000, "Query cannot exceed 1000 characters"],
    },
    aiModel: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    sharedWith: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastViewed: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
insightSchema.index({ userId: 1, datasetId: 1 });
insightSchema.index({ userId: 1, type: 1, createdAt: -1 });
insightSchema.index({ datasetId: 1, type: 1 });
insightSchema.index({ type: 1 });
insightSchema.index({ aiGenerated: 1 });
insightSchema.index({ createdAt: -1 });
insightSchema.index({ status: 1 });
insightSchema.index({ tags: 1 });
insightSchema.index({ confidence: -1 });
insightSchema.index({ title: "text", description: "text" });

// Virtual for confidence level description
insightSchema.virtual("confidenceLevel").get(function () {
  if (this.confidence >= 90) return "Very High";
  if (this.confidence >= 70) return "High";
  if (this.confidence >= 50) return "Medium";
  if (this.confidence >= 30) return "Low";
  return "Very Low";
});

// Virtual for age in days
insightSchema.virtual("ageInDays").get(function () {
  const now = new Date();
  const created = new Date(this.createdAt);
  const diffTime = Math.abs(now.getTime() - created.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Instance methods
insightSchema.methods.incrementViewCount =
  async function (): Promise<IInsight> {
    this.viewCount += 1;
    this.lastViewed = new Date();
    return await this.save();
  };

insightSchema.methods.publish = async function (): Promise<IInsight> {
  this.status = "published";
  return await this.save();
};

insightSchema.methods.archive = async function (): Promise<IInsight> {
  this.status = "archived";
  return await this.save();
};

insightSchema.methods.shareWith = async function (
  userIds: mongoose.Types.ObjectId[]
): Promise<IInsight> {
  this.sharedWith = [...new Set([...this.sharedWith, ...userIds])];
  return await this.save();
};

insightSchema.methods.unshareWith = async function (
  userId: mongoose.Types.ObjectId
): Promise<IInsight> {
  this.sharedWith = this.sharedWith.filter(
    (id: mongoose.Types.ObjectId) => id.toString() !== userId.toString()
  );
  return await this.save();
};

insightSchema.methods.unshareWith = async function (
  userId: mongoose.Types.ObjectId
): Promise<IInsight> {
  this.sharedWith = this.sharedWith.filter(
    (id: mongoose.Types.ObjectId) => id.toString() !== userId.toString()
  );
  return await this.save();
};

insightSchema.methods.isSharedWith = function (
  userId: mongoose.Types.ObjectId
): boolean {
  return this.sharedWith.some(
    (id: mongoose.Types.ObjectId) => id.toString() === userId.toString()
  );
};

export default mongoose.model<IInsight>("Insight", insightSchema);
