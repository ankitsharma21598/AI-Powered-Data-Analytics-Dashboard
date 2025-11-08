import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import streamifier from "streamifier";
import fs from "fs";
import path from "path";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const CLOUDINARY_FOLDER =
  process.env.CLOUDINARY_FOLDER || "ai-analytics-uploads";

/**
 * Upload file to Cloudinary from file path
 */
export async function uploadToCloudinary(
  filePath: string,
  options: {
    folder?: string;
    resourceType?: "auto" | "image" | "video" | "raw";
    publicId?: string;
    userId?: string;
  } = {}
): Promise<UploadApiResponse> {
  try {
    const {
      folder = CLOUDINARY_FOLDER,
      resourceType = "raw", // Use 'raw' for CSV, JSON, Excel files
      publicId,
      userId,
    } = options;

    // Create folder structure: folder/userId/filename
    const fullFolder = userId ? `${folder}/${userId}` : folder;

    const result = await cloudinary.uploader.upload(filePath, {
      folder: fullFolder,
      resource_type: resourceType,
      public_id: publicId,
      access_mode: "authenticated", // Requires signed URLs for access
      tags: ["dataset", "upload"],
      context: {
        uploadedAt: new Date().toISOString(),
      },
    });

    console.log(`✅ File uploaded to Cloudinary: ${result.public_id}`);
    return result;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error(`Failed to upload to Cloudinary: ${error}`);
  }
}

/**
 * Upload file to Cloudinary from buffer
 */
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  options: {
    folder?: string;
    resourceType?: "auto" | "image" | "video" | "raw";
    publicId?: string;
    userId?: string;
    originalName?: string;
  } = {}
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const {
      folder = CLOUDINARY_FOLDER,
      resourceType = "raw",
      publicId,
      userId,
    } = options;

    const fullFolder = userId ? `${folder}/${userId}` : folder;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: fullFolder,
        resource_type: resourceType,
        public_id: publicId,
        access_mode: "authenticated",
        tags: ["dataset", "upload"],
      },
      (error, result) => {
        if (error) {
          reject(
            new Error(`Cloudinary buffer upload failed: ${error.message}`)
          );
        } else {
          console.log(`✅ Buffer uploaded to Cloudinary: ${result?.public_id}`);
          resolve(result as UploadApiResponse);
        }
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

/**
 * Download file from Cloudinary
 */
export async function downloadFromCloudinary(
  publicId: string,
  localPath: string,
  resourceType: "image" | "video" | "raw" = "raw"
): Promise<void> {
  try {
    const url = cloudinary.url(publicId, {
      resource_type: resourceType,
      type: "authenticated",
      sign_url: true,
    });

    // Download using fetch
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();

    // Ensure directory exists
    await fs.promises.mkdir(path.dirname(localPath), { recursive: true });

    // Write to file
    await fs.promises.writeFile(localPath, Buffer.from(buffer));

    console.log(`✅ File downloaded from Cloudinary: ${publicId}`);
  } catch (error) {
    console.error("Cloudinary download error:", error);
    throw new Error(`Failed to download from Cloudinary: ${error}`);
  }
}

/**
 * Delete file from Cloudinary
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: "image" | "video" | "raw" = "raw"
): Promise<void> {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });

    if (result.result === "ok" || result.result === "not found") {
      console.log(`✅ File deleted from Cloudinary: ${publicId}`);
    } else {
      throw new Error(`Delete failed: ${result.result}`);
    }
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    throw new Error(`Failed to delete from Cloudinary: ${error}`);
  }
}

/**
 * Check if file exists in Cloudinary
 */
export async function fileExistsInCloudinary(
  publicId: string,
  resourceType: "image" | "video" | "raw" = "raw"
): Promise<boolean> {
  try {
    await cloudinary.api.resource(publicId, { resource_type: resourceType });
    return true;
  } catch (error: any) {
    if (error.http_code === 404) {
      return false;
    }
    console.error("Cloudinary file check error:", error);
    return false;
  }
}

/**
 * Generate authenticated/signed URL for private file access
 */
export function generateCloudinaryUrl(
  publicId: string,
  options: {
    resourceType?: "image" | "video" | "raw";
    expiresAt?: number; // Unix timestamp
    transformation?: any;
  } = {}
): string {
  const { resourceType = "raw", expiresAt, transformation } = options;

  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: "authenticated",
    sign_url: true,
    expires_at: expiresAt || Math.floor(Date.now() / 1000) + 3600, // 1 hour default
    transformation,
  });
}

/**
 * Get file metadata from Cloudinary
 */
export async function getFileMetadata(
  publicId: string,
  resourceType: "image" | "video" | "raw" = "raw"
): Promise<any> {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
    });

    return {
      publicId: result.public_id,
      format: result.format,
      resourceType: result.resource_type,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
      url: result.secure_url,
      createdAt: result.created_at,
      tags: result.tags,
      folder: result.folder,
    };
  } catch (error) {
    console.error("Cloudinary metadata error:", error);
    throw new Error(`Failed to get file metadata: ${error}`);
  }
}

/**
 * List files in a folder
 */
export async function listFiles(
  folder?: string,
  resourceType: "image" | "video" | "raw" = "raw"
): Promise<any[]> {
  try {
    const prefix = folder || CLOUDINARY_FOLDER;

    const result = await cloudinary.api.resources({
      type: "upload",
      resource_type: resourceType,
      prefix: prefix,
      max_results: 500,
    });

    return result.resources;
  } catch (error) {
    console.error("Cloudinary list files error:", error);
    throw new Error(`Failed to list files: ${error}`);
  }
}

/**
 * Delete files in folder
 */
export async function deleteFolder(
  folder: string,
  resourceType: "image" | "video" | "raw" = "raw"
): Promise<void> {
  try {
    await cloudinary.api.delete_resources_by_prefix(folder, {
      resource_type: resourceType,
    });

    console.log(`✅ Folder deleted from Cloudinary: ${folder}`);
  } catch (error) {
    console.error("Cloudinary delete folder error:", error);
    throw new Error(`Failed to delete folder: ${error}`);
  }
}

/**
 * Get storage usage stats
 */
export async function getStorageStats(): Promise<any> {
  try {
    const usage = await cloudinary.api.usage();

    return {
      usedCredits: usage.credits.used_percent,
      bandwidth: usage.bandwidth,
      storage: usage.storage,
      resources: usage.resources,
      transformations: usage.transformations,
      plan: usage.plan,
      lastUpdated: usage.last_updated,
    };
  } catch (error) {
    console.error("Cloudinary stats error:", error);
    throw new Error(`Failed to get storage stats: ${error}`);
  }
}

/**
 * Test Cloudinary connection
 */
export async function testCloudinaryConnection(): Promise<boolean> {
  try {
    await cloudinary.api.ping();
    console.log("✅ Cloudinary connection successful");
    return true;
  } catch (error) {
    console.error("❌ Cloudinary connection failed:", error);
    return false;
  }
}

/**
 * Check if Cloudinary is configured
 */
export function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Extract public ID from Cloudinary URL
 */
export function extractPublicId(url: string): string {
  // Extract public ID from Cloudinary URL
  // Format: https://res.cloudinary.com/{cloud_name}/raw/upload/v{version}/{public_id}.{format}
  const match = url.match(/\/v\d+\/(.+?)(\.[^.]+)?$/);
  return match ? match[1] : "";
}

export default {
  uploadToCloudinary,
  uploadBufferToCloudinary,
  downloadFromCloudinary,
  deleteFromCloudinary,
  fileExistsInCloudinary,
  generateCloudinaryUrl,
  getFileMetadata,
  listFiles,
  deleteFolder,
  getStorageStats,
  testCloudinaryConnection,
  isCloudinaryConfigured,
  extractPublicId,
};
