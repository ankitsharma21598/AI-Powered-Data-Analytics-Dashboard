import { AuthResponse, User, Dataset, Insight, ApiResponse } from "@/types/api";

const API_BASE_URL = "http://localhost:4000/api";

// Get token from localStorage
const getToken = () => localStorage.getItem("token");

// Set token in localStorage
export const setToken = (token: string) => localStorage.setItem("token", token);

// Remove token from localStorage
export const removeToken = () => localStorage.removeItem("token");

// Generic fetch wrapper
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Add authorization header if token exists and not already set
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Add content-type for JSON if body exists and not FormData
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

// Auth API
export const authApi = {
  register: (name: string, email: string, password: string) =>
    fetchApi<AuthResponse["data"]>("/user/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string) =>
    fetchApi<AuthResponse["data"]>("/user/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  getProfile: () =>
    fetchApi<User>("/user/profile", {
      method: "GET",
      headers: { Authorization: `Bearer ${getToken()}` },
    }),

  updateProfile: (data: Partial<User>) =>
    fetchApi<User>("/users/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  updatePassword: (currentPassword: string, newPassword: string) =>
    fetchApi<void>("/users/password", {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  deleteAccount: () =>
    fetchApi<void>("/users/account", {
      method: "DELETE",
    }),
};

// Dataset API
export const datasetApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    fileType?: string;
    processingStatus?: string;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    return fetchApi<Dataset[]>(`/datasets?${searchParams.toString()}`);
  },

  getById: (id: string) => fetchApi<Dataset>(`/datasets/${id}`),

  update: (id: string, data: Partial<Dataset>) =>
    fetchApi<Dataset>(`/datasets/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/datasets/${id}`, {
      method: "DELETE",
    }),

  getStats: (id: string) => fetchApi<any>(`/datasets/${id}/stats`),

  getPreview: (id: string) => fetchApi<any>(`/datasets/${id}/preview`),

  download: (id: string) => {
    const token = getToken();
    window.open(
      `${API_BASE_URL}/datasets/${id}/download?token=${token}`,
      "_blank"
    );
  },

  duplicate: (id: string) =>
    fetchApi<Dataset>(`/datasets/${id}/duplicate`, {
      method: "POST",
    }),
};

// Insight API
export const insightApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    datasetId?: string;
    type?: string;
    aiGenerated?: boolean;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    return fetchApi<Insight[]>(`/insights?${searchParams.toString()}`);
  },

  getById: (id: string) => fetchApi<Insight>(`/insights/${id}`),

  create: (data: Partial<Insight>) =>
    fetchApi<Insight>("/insights", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  generate: (datasetId: string, query?: string, type?: string) =>
    fetchApi<Insight>("/insights/generate", {
      method: "POST",
      body: JSON.stringify({ datasetId, query, type }),
    }),

  update: (id: string, data: Partial<Insight>) =>
    fetchApi<Insight>(`/insights/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/insights/${id}`, {
      method: "DELETE",
    }),

  duplicate: (id: string) =>
    fetchApi<Insight>(`/insights/${id}/duplicate`, {
      method: "POST",
    }),

  getByDataset: (datasetId: string) =>
    fetchApi<Insight[]>(`/insights/dataset/${datasetId}`),

  getStats: () => fetchApi<any>("/insights/stats"),
};

// Upload API
export const uploadApi = {
  upload: (
    file: File,
    name?: string,
    description?: string,
    tags?: string[]
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    if (name) formData.append("name", name);
    if (description) formData.append("description", description);
    if (tags) formData.append("tags", JSON.stringify(tags));

    return fetchApi<Dataset>("/upload", {
      method: "POST",
      body: formData,
    });
  },

  validate: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    return fetchApi<any>("/upload/validate", {
      method: "POST",
      body: formData,
    });
  },

  process: (datasetId: string) =>
    fetchApi<any>(`/upload/${datasetId}/process`, {
      method: "POST",
    }),

  getStatus: (datasetId: string) =>
    fetchApi<any>(`/upload/${datasetId}/status`),
};
