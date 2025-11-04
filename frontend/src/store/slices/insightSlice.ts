// src/store/slices/insightSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { insightApi } from "@/lib/api";
import { Insight } from "@/types/api";

interface InsightState {
  insights: Insight[];
  currentInsight: Insight | null;
  stats: any | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
}

const initialState: InsightState = {
  insights: [],
  currentInsight: null,
  stats: null,
  loading: false,
  generating: false,
  error: null,
};

// Async thunks
export const fetchInsights = createAsyncThunk(
  "insight/fetchAll",
  async (params?: {
    page?: number;
    limit?: number;
    datasetId?: string;
    type?: string;
    aiGenerated?: boolean;
    search?: string;
  }) => {
    const response = await insightApi.getAll(params);
    return response.data;
  }
);

export const fetchInsightById = createAsyncThunk(
  "insight/fetchById",
  async (id: string) => {
    const response = await insightApi.getById(id);
    return response.data;
  }
);

export const createInsight = createAsyncThunk(
  "insight/create",
  async (data: Partial<Insight>) => {
    const response = await insightApi.create(data);
    return response.data;
  }
);

export const generateInsight = createAsyncThunk(
  "insight/generate",
  async ({
    datasetId,
    query,
    type,
  }: {
    datasetId: string;
    query?: string;
    type?: string;
  }) => {
    const response = await insightApi.generate(datasetId, query, type);
    return response.data;
  }
);

export const updateInsight = createAsyncThunk(
  "insight/update",
  async ({ id, data }: { id: string; data: Partial<Insight> }) => {
    const response = await insightApi.update(id, data);
    return response.data;
  }
);

export const deleteInsight = createAsyncThunk(
  "insight/delete",
  async (id: string) => {
    await insightApi.delete(id);
    return id;
  }
);

export const duplicateInsight = createAsyncThunk(
  "insight/duplicate",
  async (id: string) => {
    const response = await insightApi.duplicate(id);
    return response.data;
  }
);

export const fetchInsightsByDataset = createAsyncThunk(
  "insight/fetchByDataset",
  async (datasetId: string) => {
    const response = await insightApi.getByDataset(datasetId);
    return response.data;
  }
);

export const fetchInsightStats = createAsyncThunk(
  "insight/fetchStats",
  async () => {
    const response = await insightApi.getStats();
    return response.data;
  }
);

const insightSlice = createSlice({
  name: "insight",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentInsight: (state) => {
      state.currentInsight = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch all insights
    builder
      .addCase(fetchInsights.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInsights.fulfilled, (state, action) => {
        state.loading = false;
        state.insights = action.payload;
      })
      .addCase(fetchInsights.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch insights";
      });

    // Fetch insight by ID
    builder
      .addCase(fetchInsightById.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchInsightById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentInsight = action.payload;
      })
      .addCase(fetchInsightById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch insight";
      });

    // Create insight
    builder
      .addCase(createInsight.pending, (state) => {
        state.loading = true;
      })
      .addCase(createInsight.fulfilled, (state, action) => {
        state.loading = false;
        state.insights.unshift(action.payload);
        state.currentInsight = action.payload;
      })
      .addCase(createInsight.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to create insight";
      });

    // Generate insight
    builder
      .addCase(generateInsight.pending, (state) => {
        state.generating = true;
        state.error = null;
      })
      .addCase(generateInsight.fulfilled, (state, action) => {
        state.generating = false;
        state.insights.unshift(action.payload);
        state.currentInsight = action.payload;
      })
      .addCase(generateInsight.rejected, (state, action) => {
        state.generating = false;
        state.error = action.error.message || "Failed to generate insight";
      });

    // Update insight
    builder
      .addCase(updateInsight.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateInsight.fulfilled, (state, action) => {
        state.loading = false;
        state.currentInsight = action.payload;
        const index = state.insights.findIndex(
          (i) => i._id === action.payload._id
        );
        if (index !== -1) {
          state.insights[index] = action.payload;
        }
      })
      .addCase(updateInsight.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to update insight";
      });

    // Delete insight
    builder
      .addCase(deleteInsight.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteInsight.fulfilled, (state, action) => {
        state.loading = false;
        state.insights = state.insights.filter((i) => i._id !== action.payload);
        if (state.currentInsight?._id === action.payload) {
          state.currentInsight = null;
        }
      })
      .addCase(deleteInsight.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to delete insight";
      });

    // Duplicate insight
    builder
      .addCase(duplicateInsight.pending, (state) => {
        state.loading = true;
      })
      .addCase(duplicateInsight.fulfilled, (state, action) => {
        state.loading = false;
        state.insights.unshift(action.payload);
      })
      .addCase(duplicateInsight.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to duplicate insight";
      });

    // Fetch insights by dataset
    builder
      .addCase(fetchInsightsByDataset.fulfilled, (state, action) => {
        state.insights = action.payload;
      })
      .addCase(fetchInsightsByDataset.rejected, (state, action) => {
        state.error = action.error.message || "Failed to fetch insights";
      });

    // Fetch stats
    builder
      .addCase(fetchInsightStats.fulfilled, (state, action) => {
        state.stats = action.payload;
      })
      .addCase(fetchInsightStats.rejected, (state, action) => {
        state.error = action.error.message || "Failed to fetch stats";
      });
  },
});

export const { clearError, clearCurrentInsight } = insightSlice.actions;
export default insightSlice.reducer;
