import express from "express";
import {
  register,
  login,
  getProfile,
  updateProfile,
  deleteAccount,
} from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.delete("/account", protect, deleteAccount);

// TODO: Add change password route

export default router;
