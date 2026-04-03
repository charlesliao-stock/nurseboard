import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

/**
 * BoardHistory page - View and manage saved board records
 */
export default function BoardHistory() {
  const { user, loading: authLoading } = useAuth();
  const { data: boards, isLoading, refetch } = trpc.board.list.useQuery(undefined, {
    enabled: !!user,
  });
  const deleteBoardMutation = trpc.board.delete.useMutation();

  const handleDeleteBoard = async (boardId: number) => {
    if (!confirm("確定要刪除此看板記錄嗎？")) return;

    try {
      await deleteBoardMutation.mutateAsync({ id: boardId });
      toast.success("看板已刪除");
      refetch();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("刪除失敗，請重試");
    }
  };

  if (authLoading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", margin: "0 auto" }} />
        <p style={{ marginTop: "16px" }}>載入中...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <p>請登入以查看看板記錄</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FFF5F8", padding: "40px 20px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "40px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: "bold", color: "#333", marginBottom: "8px" }}>
            📋 看板記錄
          </h1>
          <p style={{ color: "#666", marginBottom: "20px" }}>
            查看和管理您已產生的優良護理人員看板
          </p>
          <Link href="/board-generator">
            <Button style={{ background: "#FF69B4", color: "#fff" }}>
              + 建立新看板
            </Button>
          </Link>
        </div>

        {/* Content */}
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <Loader2 size={32} style={{ animation: "spin 1s linear infinite", margin: "0 auto" }} />
            <p style={{ marginTop: "16px" }}>載入看板記錄中...</p>
          </div>
        ) : !boards || boards.length === 0 ? (
          <Card style={{ padding: "40px", textAlign: "center" }}>
            <p style={{ fontSize: "16px", color: "#999" }}>
              還沒有看板記錄。<Link href="/board-generator">開始建立第一個看板</Link>
            </p>
          </Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
            {boards.map((board) => (
              <Card
                key={board.id}
                style={{
                  padding: "20px",
                  background: "#fff",
                  borderRadius: "12px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}
              >
                {/* Board Preview */}
                {board.photoUrl && (
                  <div
                    style={{
                      width: "100%",
                      height: "200px",
                      background: "#f0f0f0",
                      borderRadius: "8px",
                      marginBottom: "12px",
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={board.photoUrl}
                      alt={board.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                )}

                {/* Board Info */}
                <h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "8px", color: "#333" }}>
                  {board.name}
                </h3>
                <p style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>
                  <strong>單位：</strong> {board.department}
                </p>
                <p style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>
                  <strong>事蹟：</strong> {board.achievement}
                </p>
                <p style={{ fontSize: "12px", color: "#999", marginBottom: "12px" }}>
                  建立於 {new Date(board.createdAt).toLocaleDateString("zh-TW")}
                </p>

                {/* Actions */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button
                    variant="outline"
                    size="sm"
                    style={{ flex: 1 }}
                    onClick={() => {
                      // Download board image
                      if (board.boardImageUrl) {
                        const link = document.createElement("a");
                        link.href = board.boardImageUrl;
                        link.download = `board-${board.name}.png`;
                        link.click();
                      }
                    }}
                  >
                    <Download size={14} style={{ marginRight: "4px" }} />
                    下載
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    style={{ flex: 1 }}
                    onClick={() => handleDeleteBoard(board.id)}
                    disabled={deleteBoardMutation.isPending}
                  >
                    <Trash2 size={14} style={{ marginRight: "4px" }} />
                    刪除
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
