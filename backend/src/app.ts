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
app.use("/api/user", userRoutes);
app.use("/api/insights", insightRoutes);
app.use("/api/datasets", datasetRoutes);
app.use("/api/upload", uploadRoutes);


export default app;
