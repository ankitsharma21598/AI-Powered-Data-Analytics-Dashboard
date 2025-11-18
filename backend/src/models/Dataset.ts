import mongoose, { Document, Schema } from 'mongoose';

export interface IDataset extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: 'csv' | 'json' | 'excel' | 'other';
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>;
  rowCount: number;
  metadata: {
    uploadDate: Date;
    lastModified: Date;
    processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
    errorMessage?: string;
  };
  tags: string[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const datasetSchema = new Schema<IDataset>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Please provide a dataset name'],
      trim: true,
      maxlength: [100, 'Name cannot be more than 100 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot be more than 500 characters']
    },
    fileUrl: {
      type: String,
      required: [true, 'File URL is required']
    },
    fileName: {
      type: String,
      required: [true, 'File name is required']
    },
    fileSize: {
      type: Number,
      required: [true, 'File size is required'],
      min: [0, 'File size must be positive']
    },
    fileType: {
      type: String,
      enum: {
        values: ['csv', 'json', 'excel', 'other'],
        message: '{VALUE} is not a valid file type'
      },
      required: [true, 'File type is required']
    },
    columns: [
      {
        name: { 
          type: String, 
          required: true,
          trim: true
        },
        type: { 
          type: String, 
          required: true,
          enum: ['string', 'number', 'integer', 'float', 'boolean', 'date', 'array', 'object', 'null', 'unknown']
        },
        nullable: { 
          type: Boolean, 
          default: true 
        }
      }
    ],
    rowCount: {
      type: Number,
      default: 0,
      min: [0, 'Row count cannot be negative']
    },
    metadata: {
      uploadDate: {
        type: Date,
        default: Date.now
      },
      lastModified: {
        type: Date,
        default: Date.now
      },
      processingStatus: {
        type: String,
        enum: {
          values: ['pending', 'processing', 'completed', 'failed'],
          message: '{VALUE} is not a valid processing status'
        },
        default: 'pending'
      },
      errorMessage: {
        type: String,
        default: ''
      },
      storageType: {
        type: String,
        enum: ['local', 'gcs', 'cloudinary'],
        default: 'local'
      },
      gcsPath: {
        type: String
      },
      cloudPath: {
        type: String
      }
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true
      }
    ],
    isPublic: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
datasetSchema.index({ userId: 1, createdAt: -1 });
datasetSchema.index({ tags: 1 });
datasetSchema.index({ 'metadata.processingStatus': 1 });
datasetSchema.index({ name: 'text', description: 'text' });
datasetSchema.index({ fileType: 1 });
datasetSchema.index({ isPublic: 1 });

// Virtual for formatted file size
datasetSchema.virtual('fileSizeFormatted').get(function() {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (this.fileSize === 0) return '0 Bytes';
  const i = Math.floor(Math.log(this.fileSize) / Math.log(1024));
  return Math.round(this.fileSize / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// Virtual to populate insights count
datasetSchema.virtual('insightsCount', {
  ref: 'Insight',
  localField: '_id',
  foreignField: 'datasetId',
  count: true
});

// Pre-save middleware
datasetSchema.pre('save', function(next) {
  // Update lastModified on any change
  this.metadata.lastModified = new Date();
  next();
});

// Static methods
datasetSchema.statics.findByUser = function(userId: mongoose.Types.ObjectId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

datasetSchema.statics.findCompleted = function(userId: mongoose.Types.ObjectId) {
  return this.find({ 
    userId, 
    'metadata.processingStatus': 'completed' 
  }).sort({ createdAt: -1 });
};

// Instance methods
datasetSchema.methods.isProcessed = function(): boolean {
  return this.metadata.processingStatus === 'completed';
};

datasetSchema.methods.markAsProcessing = async function() {
  this.metadata.processingStatus = 'processing';
  this.metadata.errorMessage = '';
  return await this.save();
};

datasetSchema.methods.markAsCompleted = async function(columns: any[], rowCount: number) {
  this.metadata.processingStatus = 'completed';
  this.metadata.errorMessage = '';
  this.columns = columns;
  this.rowCount = rowCount;
  return await this.save();
};

datasetSchema.methods.markAsFailed = async function(errorMessage: string) {
  this.metadata.processingStatus = 'failed';
  this.metadata.errorMessage = errorMessage;
  return await this.save();
};

export default mongoose.model<IDataset>('Dataset', datasetSchema);