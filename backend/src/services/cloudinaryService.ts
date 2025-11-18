import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME && 
    process.env.CLOUDINARY_API_KEY && 
    process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
  console.log('✅ Cloudinary configured successfully');
} else {
  console.warn('⚠️  Cloudinary not configured - missing credentials');
}

export interface CloudinaryUploadOptions {
  userId?: string;
  publicId?: string;
  folder?: string;
  resourceType?: 'auto' | 'image' | 'video' | 'raw';
  tags?: string[];
}

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  resource_type: string;
  bytes: number;
  original_filename: string;
}

/**
 * Upload file to Cloudinary
 */
export async function uploadToCloudinary(
  localFilePath: string,
  options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult> {
  try {
    if (!isCloudinaryConfigured()) {
      throw new Error('Cloudinary is not properly configured');
    }

    // Build folder path
    const folderParts = ['datasets'];
    if (options.userId) {
      folderParts.push(options.userId);
    }
    if (options.folder) {
      folderParts.push(options.folder);
    }
    const folder = folderParts.join('/');

    // Get file extension
    const ext = path.extname(localFilePath).toLowerCase();
    
    // Build public_id with extension for raw files
    let publicId = options.publicId || `file_${Date.now()}`;
    if (options.resourceType === 'raw' && !publicId.includes('.')) {
      publicId = `${publicId}${ext}`;
    }

    const uploadOptions: any = {
      folder: folder,
      public_id: publicId,
      resource_type: options.resourceType || 'auto',
      use_filename: true,
      unique_filename: false,
      overwrite: false
    };

    if (options.tags && options.tags.length > 0) {
      uploadOptions.tags = options.tags;
    }

    console.log(`📤 Uploading to Cloudinary: ${folder}/${publicId}`);

    const result = await cloudinary.uploader.upload(localFilePath, uploadOptions);

    console.log(`✅ Upload successful: ${result.secure_url}`);

    return {
      public_id: result.public_id,
      secure_url: result.secure_url,
      url: result.url,
      format: result.format,
      resource_type: result.resource_type,
      bytes: result.bytes,
      original_filename: result.original_filename || path.basename(localFilePath)
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error(`Failed to upload to Cloudinary: ${error}`);
  }
}

/**
 * Download file from Cloudinary
 */
export async function downloadFromCloudinary(
  publicIdOrUrl: string,
  localPath: string,
  resourceType: 'image' | 'video' | 'raw' = 'raw'
): Promise<void> {
  try {
    if (!isCloudinaryConfigured()) {
      throw new Error('Cloudinary is not properly configured');
    }

    let downloadUrl: string;

    // Check if it's already a URL or a public_id
    if (publicIdOrUrl.startsWith('http://') || publicIdOrUrl.startsWith('https://')) {
      downloadUrl = publicIdOrUrl;
    } else {
      // Build URL from public_id
      downloadUrl = cloudinary.url(publicIdOrUrl, {
        resource_type: resourceType,
        secure: true,
        type: 'upload'
      });
    }

    console.log(`📥 Downloading from Cloudinary: ${downloadUrl}`);

    // Ensure directory exists
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Download file
    await downloadFile(downloadUrl, localPath);

    console.log(`✅ Download successful: ${localPath}`);
  } catch (error) {
    console.error('Cloudinary download error:', error);
    throw new Error(`Failed to download: ${error}`);
  }
}

/**
 * Helper function to download file from URL
 */
function downloadFile(url: string, localPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(localPath);

    protocol.get(url, (response) => {
      // Check for successful response
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirects
        file.close();
        fs.unlinkSync(localPath);
        if (response.headers.location) {
          downloadFile(response.headers.location, localPath)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error('Redirect without location header'));
        }
      } else {
        file.close();
        fs.unlinkSync(localPath);
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
      }
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
      reject(err);
    });

    file.on('error', (err) => {
      file.close();
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
      reject(err);
    });
  });
}

/**
 * Delete file from Cloudinary
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'raw'
): Promise<void> {
  try {
    if (!isCloudinaryConfigured()) {
      throw new Error('Cloudinary is not properly configured');
    }

    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true
    });

    console.log(`✅ File deleted from Cloudinary: ${publicId}`);
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error(`Failed to delete from Cloudinary: ${error}`);
  }
}

/**
 * Check if file exists in Cloudinary
 */
export async function fileExistsInCloudinary(
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'raw'
): Promise<boolean> {
  try {
    if (!isCloudinaryConfigured()) {
      return false;
    }

    const result = await cloudinary.api.resource(publicId, {
      resource_type: resourceType
    });

    return !!result;
  } catch (error: any) {
    if (error.error?.http_code === 404) {
      return false;
    }
    console.error('Cloudinary file check error:', error);
    return false;
  }
}

/**
 * Get file metadata from Cloudinary
 */
export async function getFileMetadata(
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'raw'
): Promise<any> {
  try {
    if (!isCloudinaryConfigured()) {
      throw new Error('Cloudinary is not properly configured');
    }

    const result = await cloudinary.api.resource(publicId, {
      resource_type: resourceType
    });

    return result;
  } catch (error) {
    console.error('Cloudinary metadata error:', error);
    throw new Error(`Failed to get file metadata: ${error}`);
  }
}

/**
 * Generate signed URL for private file access
 */
export function generateSignedUrl(
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'raw',
  expiresIn: number = 3600
): string {
  try {
    if (!isCloudinaryConfigured()) {
      throw new Error('Cloudinary is not properly configured');
    }

    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    const url = cloudinary.url(publicId, {
      resource_type: resourceType,
      type: 'authenticated',
      secure: true,
      sign_url: true,
      expires_at: expiresAt
    });

    return url;
  } catch (error) {
    console.error('Cloudinary signed URL error:', error);
    throw new Error(`Failed to generate signed URL: ${error}`);
  }
}

/**
 * List files in a folder
 */
export async function listFiles(
  folder?: string,
  resourceType: 'image' | 'video' | 'raw' = 'raw'
): Promise<any[]> {
  try {
    if (!isCloudinaryConfigured()) {
      throw new Error('Cloudinary is not properly configured');
    }

    const options: any = {
      resource_type: resourceType,
      type: 'upload',
      max_results: 500
    };

    if (folder) {
      options.prefix = folder;
    }

    const result = await cloudinary.api.resources(options);

    return result.resources || [];
  } catch (error) {
    console.error('Cloudinary list files error:', error);
    throw new Error(`Failed to list files: ${error}`);
  }
}

/**
 * Test Cloudinary connection
 */
export async function testCloudinaryConnection(): Promise<boolean> {
  try {
    if (!isCloudinaryConfigured()) {
      return false;
    }

    // Try to get account details
    await cloudinary.api.ping();

    console.log('✅ Cloudinary connection successful');
    return true;
  } catch (error) {
    console.error('❌ Cloudinary connection failed:', error);
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
 * Extract public_id from Cloudinary URL
 */
export function extractPublicId(url: string): string | null {
  try {
    // Match pattern: https://res.cloudinary.com/cloud_name/resource_type/upload/v123456/path/to/file.ext
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  } catch (error) {
    console.error('Error extracting public_id:', error);
    return null;
  }
}

/**
 * Get public URL for a file
 */
export function getPublicUrl(
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'raw'
): string {
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    secure: true,
    type: 'upload'
  });
}

/**
 * Get file info from public_id
 */
export async function getFileInfo(
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'raw'
): Promise<{
  exists: boolean;
  url?: string;
  size?: number;
  format?: string;
  createdAt?: Date;
}> {
  try {
    const metadata = await getFileMetadata(publicId, resourceType);
    
    return {
      exists: true,
      url: metadata.secure_url,
      size: metadata.bytes,
      format: metadata.format,
      createdAt: new Date(metadata.created_at)
    };
  } catch (error) {
    return { exists: false };
  }
}

export default {
  uploadToCloudinary,
  downloadFromCloudinary,
  deleteFromCloudinary,
  fileExistsInCloudinary,
  getFileMetadata,
  generateSignedUrl,
  listFiles,
  testCloudinaryConnection,
  isCloudinaryConfigured,
  extractPublicId,
  getPublicUrl,
  getFileInfo
};