import mongoose from "mongoose";
import app from "./app.js";
import dotenv from "dotenv";
dotenv.config();

mongoose
  .connect(process.env.MONGO_URI || "")
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
