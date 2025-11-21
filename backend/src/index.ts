import mongoose from "mongoose";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
// import scrapeRoutes from "./routes/scrape"
// import userRoutes from "./routes/user"
import userRoutes from "./routes/userRoutes.js";
import insightRoutes from "./routes/insightRoutes.js";
import datasetRoutes from "./routes/datasetRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import cors from "cors";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// app.use("/api/scrape", scrapeRoutes)
app.use("/", (req: Request, res: Response) => {
  res.send("AI-Powered Data Analytics Dashboard API is running.");
});
app.use("/api/user", userRoutes);
app.use("/api/insights", insightRoutes);
app.use("/api/datasets", datasetRoutes);
app.use("/api/upload", uploadRoutes);

mongoose
  .connect(process.env.MONGO_URI || "")
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
