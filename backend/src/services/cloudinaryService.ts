import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import https from 'https';
import http from 'http';
import path from 'path';
import fs from 'fs';

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
 * Upload buffer directly to Cloudinary (NO local storage)
 */
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  originalFilename: string,
  options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      return reject(new Error('Cloudinary is not properly configured'));
    }

    // Build folder path
    const folderParts = ['datasets'];
    if (options.userId) folderParts.push(options.userId);
    if (options.folder) folderParts.push(options.folder);
    const folder = folderParts.join('/');

    // Get file extension
    const ext = path.extname(originalFilename).toLowerCase();
    
    // Build public_id with extension for raw files
    let publicId = options.publicId || `file_${Date.now()}`;
    if (options.resourceType === 'raw' && !publicId.includes('.')) {
      publicId = `${publicId}${ext}`;
    }

    const uploadOptions: any = {
      folder,
      public_id: publicId,
      resource_type: options.resourceType || 'auto',
      use_filename: true,
      unique_filename: false,
      overwrite: false
    };

    if (options.tags?.length) {
      uploadOptions.tags = options.tags;
    }

    console.log(`📤 Streaming to Cloudinary: ${folder}/${publicId}`);

    // Use upload_stream for direct memory-to-cloud upload
    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', error);
          return reject(new Error(`Cloudinary upload failed: ${error.message}`));
        }
        if (!result) {
          return reject(new Error('No result from Cloudinary'));
        }

        console.log(`✅ Upload successful: ${result.secure_url}`);
        resolve({
          public_id: result.public_id,
          secure_url: result.secure_url,
          url: result.url,
          format: result.format || ext.substring(1),
          resource_type: result.resource_type,
          bytes: result.bytes,
          original_filename: originalFilename
        });
      }
    );

    // Convert buffer to readable stream and pipe to Cloudinary
    const readableStream = Readable.from(buffer);
    readableStream.pipe(uploadStream);
  });
}

/**
 * Download file from Cloudinary to buffer (NO local storage)
 */
export async function downloadToBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        if (response.headers.location) {
          return downloadToBuffer(response.headers.location).then(resolve).catch(reject);
        }
        return reject(new Error('Redirect without location'));
      }
      
      if (response.statusCode !== 200) {
        return reject(new Error(`HTTP ${response.statusCode}`));
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });

    request.on('error', reject);
  });
}

/**
 * Download from Cloudinary - supports both buffer and file output
 */
export async function downloadFromCloudinary(
  publicIdOrUrl: string,
  localPath?: string,
  resourceType: 'image' | 'video' | 'raw' = 'raw'
): Promise<Buffer | void> {
  let downloadUrl: string;

  if (publicIdOrUrl.startsWith('http://') || publicIdOrUrl.startsWith('https://')) {
    downloadUrl = publicIdOrUrl;
  } else {
    downloadUrl = cloudinary.url(publicIdOrUrl, {
      resource_type: resourceType,
      secure: true,
      type: 'upload'
    });
  }

  console.log(`📥 Downloading from Cloudinary: ${downloadUrl}`);
  
  const buffer = await downloadToBuffer(downloadUrl);
  
  // If localPath provided, write to file (for backward compatibility)
  if (localPath) {
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(localPath, buffer);
    console.log(`✅ Downloaded to: ${localPath}`);
    return;
  }

  console.log(`✅ Downloaded to buffer: ${buffer.length} bytes`);
  return buffer;
}

/**
 * Delete file from Cloudinary
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'raw'
): Promise<void> {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not properly configured');
  }

  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true
  });

  console.log(`✅ Deleted from Cloudinary: ${publicId}`);
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

export default {
  uploadBufferToCloudinary,
  downloadFromCloudinary,
  downloadToBuffer,
  deleteFromCloudinary,
  isCloudinaryConfigured,
  getPublicUrl
};