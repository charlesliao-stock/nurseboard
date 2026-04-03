import React, { useRef } from "react";
import { getTemplate } from "@/lib/boardTemplates";
import { Camera } from "lucide-react";

interface BoardPreviewProps {
  theme: string;
  department: string;
  name: string;
  achievement: string;
  photoUrl?: string;
  templateId: number;
  onPhotoClick: () => void;
}

/**
 * BoardPreview component renders the board design with real-time updates
 * Displays as a landscape A4 ratio (297mm x 210mm = 1.414:1)
 */
export const BoardPreview = React.forwardRef<HTMLDivElement, BoardPreviewProps>(
  (
    {
      theme,
      department,
      name,
      achievement,
      photoUrl,
      templateId,
      onPhotoClick,
    },
    ref
  ) => {
    const template = getTemplate(templateId);

    // Decorative elements rendering
    const renderDecoElements = () => {
      const elements: React.ReactNode[] = [];

      template.decorElements.forEach((element, index) => {
        const positions = [
          { top: "5%", left: "5%", size: "40px" },
          { top: "5%", right: "5%", size: "35px" },
          { top: "50%", right: "3%", size: "45px" },
          { bottom: "10%", left: "8%", size: "38px" },
          { bottom: "5%", right: "10%", size: "42px" },
        ];

        const pos = positions[index % positions.length];

        if (element === "heart") {
          elements.push(
            <div
              key={`heart-${index}`}
              style={{
                position: "absolute",
                ...pos,
                fontSize: pos.size,
                opacity: 0.6,
              }}
            >
              ❤️
            </div>
          );
        } else if (element === "cross") {
          elements.push(
            <div
              key={`cross-${index}`}
              style={{
                position: "absolute",
                ...pos,
                fontSize: pos.size,
                opacity: 0.5,
                color: template.accentColor,
              }}
            >
              ✚
            </div>
          );
        } else if (element === "bubble") {
          elements.push(
            <div
              key={`bubble-${index}`}
              style={{
                position: "absolute",
                ...pos,
                width: pos.size,
                height: pos.size,
                borderRadius: "50%",
                border: `2px solid ${template.accentColor}`,
                opacity: 0.3,
              }}
            />
          );
        } else if (element === "flower") {
          elements.push(
            <div
              key={`flower-${index}`}
              style={{
                position: "absolute",
                ...pos,
                fontSize: pos.size,
                opacity: 0.5,
              }}
            >
              🌸
            </div>
          );
        } else if (element === "leaf") {
          elements.push(
            <div
              key={`leaf-${index}`}
              style={{
                position: "absolute",
                ...pos,
                fontSize: pos.size,
                opacity: 0.4,
              }}
            >
              🍃
            </div>
          );
        } else if (element === "star") {
          elements.push(
            <div
              key={`star-${index}`}
              style={{
                position: "absolute",
                ...pos,
                fontSize: pos.size,
                opacity: 0.4,
              }}
            >
              ⭐
            </div>
          );
        }
      });

      return elements;
    };

    return (
      <div
        ref={ref}
        style={{
          width: "100%",
          aspectRatio: "1.414 / 1", // A4 landscape ratio
          background: `linear-gradient(135deg, ${template.primaryColor} 0%, ${template.accentColor}20 100%)`,
          position: "relative",
          overflow: "hidden",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          padding: "40px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Decorative background elements */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {renderDecoElements()}
        </div>

        {/* Main content */}
        <div style={{ position: "relative", zIndex: 10, display: "flex", gap: "30px" }}>
          {/* Photo section */}
          <div
            onClick={onPhotoClick}
            style={{
              flex: "0 0 200px",
              height: "200px",
              borderRadius: "50%",
              background: photoUrl ? `url(${photoUrl})` : "#fff",
              backgroundSize: "cover",
              backgroundPosition: "center",
              border: `4px solid ${template.accentColor}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
              transition: "transform 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            }}
          >
            {!photoUrl && (
              <div style={{ textAlign: "center" }}>
                <Camera size={48} color={template.accentColor} opacity={0.5} />
                <div style={{ fontSize: "12px", marginTop: "8px", color: template.accentColor }}>
                  點擊上傳照片
                </div>
              </div>
            )}
          </div>

          {/* Text content section */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {/* Theme title */}
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: template.textColor,
                marginBottom: "12px",
              }}
            >
              {theme}
            </div>

            {/* Department and name */}
            <div
              style={{
                fontSize: "18px",
                color: template.accentColor,
                marginBottom: "8px",
              }}
            >
              {department}
            </div>

            <div
              style={{
                fontSize: "32px",
                fontWeight: "bold",
                color: template.textColor,
                marginBottom: "16px",
              }}
            >
              {name}
            </div>

            {/* Achievement badge */}
            <div
              style={{
                display: "inline-block",
                background: template.accentColor,
                color: "#fff",
                padding: "6px 16px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: "bold",
                marginBottom: "12px",
                width: "fit-content",
              }}
            >
              優良事蹟
            </div>

            {/* Achievement text */}
            <div
              style={{
                fontSize: "14px",
                color: template.textColor,
                lineHeight: "1.6",
                fontWeight: "500",
              }}
            >
              {achievement}
            </div>
          </div>
        </div>

        {/* Footer decoration */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            textAlign: "center",
            fontSize: "12px",
            color: template.accentColor,
            opacity: 0.7,
          }}
        >
          ❤️ 感謝您的專業與關愛 ❤️
        </div>
      </div>
    );
  }
);

BoardPreview.displayName = "BoardPreview";
