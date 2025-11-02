import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { CustomError } from "./errorHandler.js";
import User from "../models/User.js";
import type { IUser } from "../models/User.js";

// Extend Express Request interface to include user
export interface AuthRequest extends Request {
  user?: IUser;
}

// Extend Express Request interface to include file
export interface MulterRequest extends AuthRequest {
  file?: Express.Multer.File;
  files?: Express.Multer.File[];
}

// JWT Payload interface
interface JwtPayload {
  id: string;
  iat?: number;
  exp?: number;
}

/**
 * Protect routes - Verify JWT token
 * @middleware
 */
export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // Check for token in Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    // Alternative: Check for token in cookies (if using cookie-parser)
    // else if (req.cookies?.token) {
    //   token = req.cookies.token;
    // }

    // Check if token exists
    if (!token) {
      throw new CustomError("Not authorized to access this route", 401);
    }

    try {
      // Verify token
      const jwtSecret = process.env.JWT_SECRET;

      if (!jwtSecret) {
        throw new CustomError("JWT_SECRET is not defined", 500);
      }

      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

      // Get user from token (exclude password)
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        throw new CustomError("User not found", 404);
      }

      // Check if user is active
      if (!user.isActive) {
        throw new CustomError("User account is deactivated", 403);
      }

      // Attach user to request object
      req.user = user;
      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new CustomError("Invalid token", 401);
      } else if (error instanceof jwt.TokenExpiredError) {
        throw new CustomError("Token expired", 401);
      } else {
        throw error;
      }
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Authorize specific roles
 * @param roles - Allowed roles
 * @middleware
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new CustomError("User not authenticated", 401);
      }

      if (!roles.includes(req.user.role)) {
        throw new CustomError(
          `User role '${req.user.role}' is not authorized to access this route`,
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Optional authentication - Attach user if token exists, but don't require it
 * @middleware
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (token && process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
        const user = await User.findById(decoded.id).select("-password");

        if (user && user.isActive) {
          req.user = user;
        }
      } catch (error) {
        // Token invalid or expired - continue without user
        console.log("Optional auth failed:", error);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user owns the resource
 * @param resourceModel - Mongoose model to check
 * @param resourceIdParam - Request param containing resource ID
 * @middleware
 */
export const checkOwnership = (
  resourceModel: any,
  resourceIdParam: string = "id"
) => {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new CustomError("User not authenticated", 401);
      }

      const resourceId = req.params[resourceIdParam];
      const resource = await resourceModel.findById(resourceId);

      if (!resource) {
        throw new CustomError("Resource not found", 404);
      }

      // Check if user owns the resource
      if (resource.userId.toString() !== req.user.id.toString()) {
        throw new CustomError("Not authorized to access this resource", 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Rate limiting by user
 * Simple in-memory rate limiter (use Redis in production)
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimitByUser = (
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        return next();
      }

      const userId = req.user.id.toString();
      const now = Date.now();
      const userRequests = requestCounts.get(userId);

      if (!userRequests || now > userRequests.resetTime) {
        // First request or window expired
        requestCounts.set(userId, {
          count: 1,
          resetTime: now + windowMs,
        });
        return next();
      }

      if (userRequests.count >= maxRequests) {
        throw new CustomError(
          "Too many requests. Please try again later.",
          429
        );
      }

      // Increment count
      userRequests.count++;
      requestCounts.set(userId, userRequests);

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Verify email (for future email verification feature)
 * @middleware
 */
export const requireEmailVerification = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.user) {
      throw new CustomError("User not authenticated", 401);
    }

    // Add email verification field to User model if needed
    // if (!req.user.emailVerified) {
    //   throw new CustomError('Please verify your email address', 403);
    // }

    next();
  } catch (error) {
    next(error);
  }
};
