import { supabase } from '../utils/supabase';
import RNFS from 'react-native-fs';

export interface FileUpload {
  localUri: string;
  fileName: string;
  fileType: string;
  tripId: string;
  userId: string;
}

export interface FileUploadResult {
  success: boolean;
  fileUrl?: string;
  error?: string;
}

export class FileService {
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private supportedTypes: string[] = ['image/jpeg', 'image/png', 'application/gpx+xml', 'application/vnd.google-earth.kml+xml'];

  /**
   * Upload file to Supabase storage
   * @param file - File upload details
   * @returns FileUploadResult with success status and file URL
   */
  async uploadFile(file: FileUpload): Promise<FileUploadResult> {
    if (!supabase) {
      return {
        success: false,
        error: 'Supabase not configured',
      };
    }

    try {
      // Validate file
      const validation = await this.validateFile(file);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      // Read file as base64
      const fileData = await RNFS.readFile(file.localUri, 'base64');
      const buffer = this.base64ToArrayBuffer(fileData);

      // Construct storage path: {userId}/{tripId}/{fileName}
      const storagePath = `${file.userId}/${file.tripId}/${file.fileName}`;

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('trip-files')
        .upload(storagePath, buffer, {
          contentType: file.fileType,
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('trip-files')
        .getPublicUrl(storagePath);

      return {
        success: true,
        fileUrl: urlData.publicUrl,
      };
    } catch (error) {
      console.error('File upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Queue file for upload when online
   * This is handled by SyncService, so this method just validates and prepares the file
   * @param file - File upload details
   */
  async queueFileUpload(file: FileUpload): Promise<void> {
    const validation = await this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // File will be queued by SyncService
    console.log(`File queued for upload: ${file.fileName}`);
  }

  /**
   * Get file URL from storage
   * @param path - Storage path (userId/tripId/fileName)
   * @returns File URL
   */
  async getFileUrl(path: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data } = supabase.storage
      .from('trip-files')
      .getPublicUrl(path);

    return data.publicUrl;
  }

  /**
   * Delete file from storage
   * @param path - Storage path (userId/tripId/fileName)
   */
  async deleteFile(path: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { error } = await supabase.storage
      .from('trip-files')
      .remove([path]);

    if (error) {
      throw error;
    }

    console.log(`File deleted: ${path}`);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Validate file before upload
   * @param file - File to validate
   * @returns Validation result
   */
  private async validateFile(file: FileUpload): Promise<{ valid: boolean; error?: string }> {
    // Check file exists
    const exists = await RNFS.exists(file.localUri);
    if (!exists) {
      return { valid: false, error: 'File does not exist' };
    }

    // Check file size
    const stat = await RNFS.stat(file.localUri);
    if (parseInt(stat.size) > this.maxFileSize) {
      return {
        valid: false,
        error: `File size exceeds maximum of ${this.maxFileSize / 1024 / 1024}MB`,
      };
    }

    // Check file type
    if (!this.supportedTypes.includes(file.fileType)) {
      return {
        valid: false,
        error: `File type ${file.fileType} is not supported. Supported types: ${this.supportedTypes.join(', ')}`,
      };
    }

    return { valid: true };
  }

  /**
   * Convert base64 string to ArrayBuffer
   * @param base64 - Base64 encoded string
   * @returns ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
