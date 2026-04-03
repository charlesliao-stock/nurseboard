import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Heart, Stethoscope } from "lucide-react";

/**
 * Home page - Landing page for nurse board generator
 */
export default function Home() {
  const { user, isAuthenticated } = useAuth();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      window.location.href = "/board-generator";
    } else {
      window.location.href = getLoginUrl();
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #FFB6D9 0%, #FFE4F0 100%)" }}>
      {/* Header */}
      <div style={{ padding: "20px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "24px", fontWeight: "bold", color: "#2C3E50", display: "flex", alignItems: "center", gap: "8px" }}>
          <Heart size={28} fill="#FF69B4" color="#FF69B4" />
          優良護理人員看板
        </div>
        {isAuthenticated && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ color: "#2C3E50", fontWeight: "500" }}>{user?.name}</span>
            <a href="/board-history" style={{ color: "#FF69B4", textDecoration: "none", fontWeight: "500" }}>
              看板記錄
            </a>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "60px 40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", alignItems: "center" }}>
        {/* Left: Features */}
        <div>
          <h1 style={{ fontSize: "48px", fontWeight: "bold", color: "#2C3E50", marginBottom: "24px", lineHeight: "1.2" }}>
            為優秀護理師
            <br />
            製作專業表揚看板
          </h1>
          <p style={{ fontSize: "16px", color: "#555", marginBottom: "32px", lineHeight: "1.8" }}>
            快速製作精美的護理人員表揚看板。選擇喜愛的版型、上傳照片、填寫事蹟，一鍵匯出高畫質看板並上傳至雲端。
          </p>

          {/* Features List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <Heart size={20} fill="#FF69B4" color="#FF69B4" style={{ marginTop: "4px", flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: "bold", color: "#2C3E50" }}>10 種粉色花卉版型</div>
                <div style={{ fontSize: "14px", color: "#666" }}>每種版型獨特設計，搭配醫療圖示</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <Stethoscope size={20} color="#FF69B4" style={{ marginTop: "4px", flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: "bold", color: "#2C3E50" }}>即時預覽</div>
                <div style={{ fontSize: "14px", color: "#666" }}>輸入資料時即時看到看板效果</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <Heart size={20} fill="#FF69B4" color="#FF69B4" style={{ marginTop: "4px", flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: "bold", color: "#2C3E50" }}>AI 文案生成</div>
                <div style={{ fontSize: "14px", color: "#666" }}>自動產生專業的優良事蹟文案</div>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <Button
            onClick={handleGetStarted}
            style={{
              background: "#FF69B4",
              color: "#fff",
              padding: "14px 32px",
              fontSize: "16px",
              fontWeight: "bold",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.3s",
            }}
          >
            {isAuthenticated ? "開始製作看板" : "登入開始使用"}
          </Button>
        </div>

        {/* Right: Visual Preview */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div
            style={{
              width: "100%",
              maxWidth: "400px",
              aspectRatio: "1",
              background: "linear-gradient(135deg, #FFCCCB 0%, #FFB6D9 100%)",
              borderRadius: "12px",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Decorative elements */}
            <div style={{ position: "absolute", top: "20px", left: "20px", fontSize: "48px", opacity: 0.3 }}>❤️</div>
            <div style={{ position: "absolute", bottom: "20px", right: "20px", fontSize: "48px", opacity: 0.3 }}>✚</div>
            <div style={{ textAlign: "center", color: "#fff", zIndex: 10 }}>
              <Heart size={64} fill="#fff" color="#fff" style={{ margin: "0 auto 16px" }} />
              <div style={{ fontSize: "24px", fontWeight: "bold" }}>優良護理人員</div>
              <div style={{ fontSize: "14px", marginTop: "8px", opacity: 0.9 }}>表揚看板預覽</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
