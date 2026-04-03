import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * Convert data URL to buffer
 */
function dataURLToBuffer(dataURL: string): Buffer {
  const matches = dataURL.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid data URL format");
  }
  return Buffer.from(matches[2], "base64");
}

/**
 * Upload file to Google Drive using gws CLI
 * Returns the file ID and URL
 */
export async function uploadToGoogleDrive(
  filePathOrDataURL: string,
  fileName: string,
  mimeType: string = "image/png"
): Promise<{ fileId: string; url: string }> {
  let tempFilePath: string | null = null;
  try {
    let filePath = filePathOrDataURL;

    // Check if input is a data URL
    if (filePathOrDataURL.startsWith("data:")) {
      // Convert data URL to buffer and save to temp file
      const buffer = dataURLToBuffer(filePathOrDataURL);
      tempFilePath = `/tmp/board-${Date.now()}.png`;
      await fs.promises.writeFile(tempFilePath, buffer);
      filePath = tempFilePath;
    } else if (!fs.existsSync(filePathOrDataURL)) {
      throw new Error(`File not found: ${filePathOrDataURL}`);
    }

    // Use gws CLI to upload file
    // The file will be uploaded to the root of Google Drive
    const command = `gws drive files create --upload "${filePath}" --json '{"name": "${fileName}", "mimeType": "${mimeType}"}'`;

    const output = execSync(command, { encoding: "utf-8" });
    const result = JSON.parse(output);

    if (!result.id) {
      throw new Error("Failed to get file ID from upload response");
    }

    // Construct Google Drive URL
    const fileId = result.id;
    const url = `https://drive.google.com/file/d/${fileId}/view`;

    return { fileId, url };
  } catch (error) {
    console.error("[Google Drive] Upload error:", error);
    throw error;
  } finally {
    // Clean up temp file if created
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {
        console.warn("Failed to clean up temp file:", err);
      }
    }
  }
}

/**
 * Create a folder in Google Drive
 */
export async function createGoogleDriveFolder(folderName: string): Promise<string> {
  try {
    const command = `gws drive files create --json '{"name": "${folderName}", "mimeType": "application/vnd.google-apps.folder"}'`;

    const output = execSync(command, { encoding: "utf-8" });
    const result = JSON.parse(output);

    if (!result.id) {
      throw new Error("Failed to get folder ID");
    }

    return result.id;
  } catch (error) {
    console.error("[Google Drive] Folder creation error:", error);
    throw error;
  }
}

/**
 * Upload multiple files to Google Drive
 */
export async function uploadMultipleFilesToGoogleDrive(
  files: Array<{ filePath: string; fileName: string; mimeType?: string }>
): Promise<Array<{ fileName: string; fileId: string; url: string }>> {
  const results: Array<{ fileName: string; fileId: string; url: string }> = [];

  for (const file of files) {
    try {
      const { fileId, url } = await uploadToGoogleDrive(
        file.filePath,
        file.fileName,
        file.mimeType || "application/octet-stream"
      );
      results.push({ fileName: file.fileName, fileId, url });
    } catch (error) {
      console.error(`[Google Drive] Failed to upload ${file.fileName}:`, error);
      // Continue with next file
    }
  }

  return results;
}
