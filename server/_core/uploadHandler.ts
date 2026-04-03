import { Response } from "express";
import { storagePut } from "../storage";
import { randomUUID } from "crypto";

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

interface UploadRequest {
  file?: MulterFile;
}

/**
 * Handle photo upload to S3
 * Expects multipart/form-data with 'file' field
 */
export async function handlePhotoUpload(req: UploadRequest, res: Response): Promise<void> {
  try {
    // Check if file exists
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    // Validate file type
    if (!req.file.mimetype.startsWith("image/")) {
      res.status(400).json({ error: "Only image files are allowed" });
      return;
    }

    // Validate file size (max 5MB)
    if (req.file.size > 5 * 1024 * 1024) {
      res.status(413).json({ error: "File size exceeds 5MB limit" });
      return;
    }

    // Validate file name
    if (!req.file.originalname) {
      res.status(400).json({ error: "Invalid file name" });
      return;
    }

    // Generate unique file key
    const fileExt = req.file.originalname.split(".").pop() || "jpg";
    const fileKey = `photos/${randomUUID()}.${fileExt}`;

    // Upload to S3
    const { url } = await storagePut(fileKey, req.file.buffer, req.file.mimetype);

    res.json({ url, key: fileKey });
  } catch (error) {
    console.error("[Upload] Error:", error);
    res.status(500).json({
      error: "Upload failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
