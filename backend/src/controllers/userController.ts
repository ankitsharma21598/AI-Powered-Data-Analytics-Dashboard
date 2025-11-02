import type { Response, NextFunction } from "express";
import jwt, {
  type Secret,
  type JwtPayload,
  type SignOptions,
} from "jsonwebtoken";
import User from "../models/User.js";
import type { AuthRequest } from "../middleware/auth.js";
import { CustomError } from "../middleware/errorHandler.js";

type TimeString = `${number}${"s" | "m" | "h" | "d" | "y"}`;

// Generate JWT Token
export const generateToken = (userId: string): string => {
  // Explicitly tell TypeScript this is a jwt.Secret
  const secret: Secret = process.env.JWT_SECRET as Secret;

  const expiresIn: TimeString = "7d"; // ✅ matches `StringValue` type

  const options: SignOptions = { expiresIn };

  // ✅ Correctly typed usage
  return jwt.sign({ id: userId }, secret, options);
};

// @desc    Register new user
// @route   POST /api/users/register
// @access  Public
export const register = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      throw new CustomError("User already exists", 400);
    }

    // Create user
    const user = await User.create({ name, email, password });

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user?.id.toString()),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/users/login
// @access  Public
export const login = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      throw new CustomError("Please provide email and password", 400);
    }

    // Check for user
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      throw new CustomError("Invalid credentials", 401);
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new CustomError("Invalid credentials", 401);
    }

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user?.id.toString()),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
export const getProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id);

    if (!user) {
      throw new CustomError("User not found", 404);
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, avatar } = req.body;

    const user = await User.findById(req.user?._id);

    if (!user) {
      throw new CustomError("User not found", 404);
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.avatar = avatar || user.avatar;

    const updatedUser = await user.save();

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user account
// @route   DELETE /api/users/account
// @access  Private
export const deleteAccount = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);

    if (!user) {
      throw new CustomError("User not found", 404);
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: "User account deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
