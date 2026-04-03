import React, { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { BoardPreview } from "@/components/BoardPreview";
import { getAllTemplates } from "@/lib/boardTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Wand2, Download, Upload } from "lucide-react";
import { toast } from "sonner";

/**
 * BoardGenerator page - Main interface for creating nurse recognition boards
 * Features: dual-column layout, template selection, real-time preview, photo upload
 */
export default function BoardGenerator() {
  const boardPreviewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [theme, setTheme] = useState("2026優良護理人員");
  const [department, setDepartment] = useState("");
  const [name, setName] = useState("");
  const [achievement, setAchievement] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [templateId, setTemplateId] = useState(1);
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [exportFormat, setExportFormat] = useState<"png" | "jpg">("png");

  // API mutations
  const generateAchievementMutation = trpc.board.generateAchievementText.useMutation();
  const createBoardMutation = trpc.board.create.useMutation();
  const uploadToGoogleDriveMutation = trpc.board.uploadToGoogleDrive.useMutation();

  // Handle photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("請上傳圖片檔案");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("檔案大小不能超過 5MB");
      return;
    }

    try {
      setIsUploadingPhoto(true);

      // Create FormData for upload
      const formData = new FormData();
      formData.append("file", file);

      // Upload to server (which will upload to S3)
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("上傳失敗");
      }

      const data = await response.json();
      setPhotoUrl(data.url);
      toast.success("照片上傳成功");
    } catch (error) {
      console.error("Photo upload error:", error);
      toast.error("照片上傳失敗，請重試");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Generate achievement text using LLM
  const handleGenerateAchievementText = async () => {
    if (!achievement.trim()) {
      toast.error("請先輸入簡短描述");
      return;
    }

    try {
      setIsGeneratingText(true);
      const result = await generateAchievementMutation.mutateAsync({
        description: achievement,
      });
      setAchievement(result);
      toast.success("文案已自動生成");
    } catch (error) {
      console.error("Generate text error:", error);
      toast.error("文案生成失敗，請重試");
    } finally {
      setIsGeneratingText(false);
    }
  };

  // Save board record
  const handleSaveBoard = async () => {
    if (!department || !name || !achievement) {
      toast.error("請填寫所有必填欄位");
      return;
    }

    try {
      const result = await createBoardMutation.mutateAsync({
        department,
        name,
        achievement,
        photoUrl,
        templateId,
        theme,
      });

      toast.success("看板已保存");
      return result;
    } catch (error) {
      console.error("Save board error:", error);
      toast.error("保存失敗，請重試");
    }
  };

  // Export board as image
  const handleExportBoard = async () => {
    if (!boardPreviewRef.current) return;

    try {
      // Dynamic import html2canvas
      const html2canvas = (await import("html2canvas")).default;

      const canvas = await html2canvas(boardPreviewRef.current, {
        scale: 2,
        backgroundColor: null,
      });

      // Create download link
      const link = document.createElement("a");
      const mimeType = exportFormat === "jpg" ? "image/jpeg" : "image/png";
      const fileExt = exportFormat === "jpg" ? "jpg" : "png";
      link.href = canvas.toDataURL(mimeType);
      link.download = `nurse-board-${name}-${Date.now()}.${fileExt}`;
      link.click();

      toast.success("看板已匯出");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("匯出失敗，請重試");
    }
  };

  // Upload to Google Drive
  const handleUploadToGoogleDrive = async () => {
    if (!boardPreviewRef.current) return;

    try {
      // First save the board
      const savedBoard = await handleSaveBoard();
      if (!savedBoard) return;

      // Generate board image
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(boardPreviewRef.current, {
        scale: 2,
        backgroundColor: null,
      });

      const boardImageUrl = canvas.toDataURL("image/png");

      // Upload to Google Drive
      await uploadToGoogleDriveMutation.mutateAsync({
        boardImageUrl,
        photoUrl,
        boardId: savedBoard.id,
        name,
      });

      toast.success("已上傳至 Google Drive");
    } catch (error) {
      console.error("Google Drive upload error:", error);
      toast.error("上傳至 Google Drive 失敗，請重試");
    }
  };

  const templates = getAllTemplates();
  const charCount = achievement.length;

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", padding: "24px" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "8px" }}>
            優良護理人員看板產生器
          </h1>
          <p style={{ color: "#666", fontSize: "14px" }}>
            快速製作專業的表揚看板，一鍵匯出並上傳至雲端
          </p>
        </div>

        {/* Main layout: Left control + Right preview */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "24px" }}>
          {/* Left: Control Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Template Selection */}
            <Card style={{ padding: "20px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "12px" }}>
                版型選擇
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setTemplateId(template.id)}
                    style={{
                      padding: "12px",
                      borderRadius: "6px",
                      border: templateId === template.id ? "2px solid #FF69B4" : "1px solid #ddd",
                      background: templateId === template.id ? "#FFE4F0" : "#fff",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      fontSize: "12px",
                      fontWeight: "500",
                    }}
                  >
                    <div style={{ fontSize: "10px", color: template.accentColor }}>
                      {template.name}
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            {/* Data Input Form */}
            <Card style={{ padding: "20px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "12px" }}>
                資料輸入
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Theme */}
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#333" }}>
                    主題
                  </label>
                  <Input
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder="例如：2026優良護理人員"
                    style={{ marginTop: "4px" }}
                  />
                </div>

                {/* Department */}
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#333" }}>
                    單位 *
                  </label>
                  <Input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="例如：手術室"
                    style={{ marginTop: "4px" }}
                  />
                </div>

                {/* Name */}
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#333" }}>
                    姓名 *
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如：李婉如"
                    style={{ marginTop: "4px" }}
                  />
                </div>

                {/* Achievement */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "bold", color: "#333" }}>
                      優良事蹟 *
                    </label>
                    <span style={{ fontSize: "12px", color: charCount > 30 ? "#ff4444" : "#999" }}>
                      {charCount}/30
                    </span>
                  </div>
                  <Textarea
                    value={achievement}
                    onChange={(e) => setAchievement(e.target.value.substring(0, 30))}
                    placeholder="描述護理師的優良事蹟..."
                    style={{ marginTop: "4px", minHeight: "80px" }}
                  />
                </div>

                {/* Generate AI Text Button */}
                <Button
                  onClick={handleGenerateAchievementText}
                  disabled={isGeneratingText || !achievement.trim()}
                  variant="outline"
                  style={{ width: "100%" }}
                >
                  {isGeneratingText ? (
                    <>
                      <Loader2 size={16} style={{ marginRight: "8px", animation: "spin 1s linear infinite" }} />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Wand2 size={16} style={{ marginRight: "8px" }} />
                      AI 生成文案
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {/* Export Format Selection */}
            <Card style={{ padding: "20px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "12px" }}>
                匯出格式
              </h2>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setExportFormat("png")}
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "6px",
                    border: exportFormat === "png" ? "2px solid #FF69B4" : "1px solid #ddd",
                    background: exportFormat === "png" ? "#FFE4F0" : "#fff",
                    cursor: "pointer",
                    fontWeight: "500",
                  }}
                >
                  PNG
                </button>
                <button
                  onClick={() => setExportFormat("jpg")}
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "6px",
                    border: exportFormat === "jpg" ? "2px solid #FF69B4" : "1px solid #ddd",
                    background: exportFormat === "jpg" ? "#FFE4F0" : "#fff",
                    cursor: "pointer",
                    fontWeight: "500",
                  }}
                >
                  JPG
                </button>
              </div>
            </Card>

            {/* Action Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Button
                onClick={handleExportBoard}
                style={{ width: "100%", background: "#FF69B4", color: "#fff" }}
              >
                <Download size={16} style={{ marginRight: "8px" }} />
                匯出看板 ({exportFormat.toUpperCase()})
              </Button>
              <Button
                onClick={handleSaveBoard}
                variant="outline"
                style={{ width: "100%" }}
              >
                <Upload size={16} style={{ marginRight: "8px" }} />
                保存記錄
              </Button>
              <Button
                onClick={handleUploadToGoogleDrive}
                disabled={uploadToGoogleDriveMutation.isPending}
                style={{ width: "100%", background: "#4285F4", color: "#fff" }}
              >
                {uploadToGoogleDriveMutation.isPending ? (
                  <>
                    <Loader2 size={16} style={{ marginRight: "8px", animation: "spin 1s linear infinite" }} />
                    上傳中...
                  </>
                ) : (
                  <>
                    <Upload size={16} style={{ marginRight: "8px" }} />
                    上傳至 Google Drive
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right: Live Preview */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: "14px", fontWeight: "bold", color: "#333" }}>
              即時預覽
            </div>
            <div style={{ flex: 1, minHeight: "400px" }}>
              <BoardPreview
                ref={boardPreviewRef}
                theme={theme}
                department={department}
                name={name}
                achievement={achievement}
                photoUrl={photoUrl}
                templateId={templateId}
                onPhotoClick={() => fileInputRef.current?.click()}
              />
            </div>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          style={{ display: "none" }}
        />
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
