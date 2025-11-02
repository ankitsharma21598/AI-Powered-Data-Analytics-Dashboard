export interface User {
  _id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
  };
}

export interface Dataset {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: "csv" | "json" | "excel" | "other";
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>;
  rowCount: number;
  metadata: {
    uploadDate: string;
    lastModified: string;
    processingStatus: "pending" | "processing" | "completed" | "failed";
    errorMessage?: string;
  };
  tags: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Insight {
  _id: string;
  userId: string;
  datasetId: string;
  title: string;
  description: string;
  type: "trend" | "anomaly" | "correlation" | "prediction" | "summary" | "custom";
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
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
  total?: number;
  page?: number;
  pages?: number;
}
