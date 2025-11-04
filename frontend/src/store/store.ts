// src/store/store.ts
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
// import datasetReducer from './slices/datasetSlice';
// import insightReducer from './slices/insightSlice';
// import uploadReducer from './slices/uploadSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    // dataset: datasetReducer,
    // insight: insightReducer,
    // upload: uploadReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
