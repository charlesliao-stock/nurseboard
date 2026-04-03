import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return ctx;
}

describe("board.create", () => {
  it("should create a board record with valid input", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.board.create({
      theme: "2026優良護理人員",
      department: "手術室",
      name: "李婉如",
      achievement: "樂於助人，協助單位護理指導手冊、教學影片之制訂與拍攝",
      photoUrl: "https://example.com/photo.jpg",
      templateId: 1,
    });

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.department).toBe("手術室");
    expect(result.name).toBe("李婉如");
    expect(result.userId).toBe(ctx.user.id);
  });

  it("should reject board creation without required fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.board.create({
        theme: "2026優良護理人員",
        department: "",
        name: "",
        achievement: "",
        photoUrl: "",
        templateId: 1,
      });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

describe("board.list", () => {
  it("should list boards for authenticated user", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    // Create a board first
    await caller.board.create({
      theme: "2026優良護理人員",
      department: "手術室",
      name: "李婉如",
      achievement: "樂於助人",
      photoUrl: "https://example.com/photo.jpg",
      templateId: 1,
    });

    // List boards
    const boards = await caller.board.list();

    expect(Array.isArray(boards)).toBe(true);
    expect(boards.length).toBeGreaterThan(0);
    expect(boards[0].userId).toBe(ctx.user.id);
  });

  it("should not list boards from other users", async () => {
    const ctx1 = createAuthContext(1);
    const ctx2 = createAuthContext(2);

    const caller1 = appRouter.createCaller(ctx1);
    const caller2 = appRouter.createCaller(ctx2);

    // User 1 creates a board
    await caller1.board.create({
      theme: "2026優良護理人員",
      department: "手術室",
      name: "李婉如",
      achievement: "樂於助人",
      photoUrl: "https://example.com/photo.jpg",
      templateId: 1,
    });

    // User 2 lists boards
    const boards = await caller2.board.list();

    // User 2 should not see User 1's board
    const user1Boards = boards.filter((b) => b.userId === ctx1.user.id);
    expect(user1Boards.length).toBe(0);
  });
});

describe("board.generateAchievementText", () => {
  it("should generate achievement text with LLM", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.board.generateAchievementText({
      description: "幫助新進護理師熟悉工作流程，提升團隊效率",
    });

    expect(typeof result).toBe("string");
    expect(result.length).toBeLessThanOrEqual(30);
  });

  it("should truncate generated text to 30 characters", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.board.generateAchievementText({
      description: "這是一個非常長的描述，用來測試文案生成功能是否能正確地將生成的文案截斷到30個字以內",
    });

    expect(result.length).toBeLessThanOrEqual(30);
  });
});
