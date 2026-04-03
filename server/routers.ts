import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import {
  getUserBoardRecords,
  createBoardRecord,
  updateBoardRecord,
  deleteBoardRecord,
} from "./db";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  board: router({
    /**
     * Get all board records for the current user
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserBoardRecords(ctx.user.id);
    }),

    /**
     * Create a new board record
     */
    create: protectedProcedure
      .input(
        z.object({
          department: z.string().min(1),
          name: z.string().min(1),
          achievement: z.string().max(30),
          photoUrl: z.string().optional(),
          templateId: z.number().min(1).max(10),
          theme: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return createBoardRecord({
          userId: ctx.user.id,
          department: input.department,
          name: input.name,
          achievement: input.achievement,
          photoUrl: input.photoUrl,
          templateId: input.templateId,
          theme: input.theme || "2026優良護理人員",
        });
      }),

    /**
     * Update a board record
     */
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          department: z.string().optional(),
          name: z.string().optional(),
          achievement: z.string().max(30).optional(),
          photoUrl: z.string().optional(),
          templateId: z.number().min(1).max(10).optional(),
          boardImageUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Verify ownership
        const records = await getUserBoardRecords(ctx.user.id);
        if (!records.find(r => r.id === input.id)) {
          throw new Error("Unauthorized");
        }
        const { id, ...updates } = input;
        return updateBoardRecord(id, updates);
      }),

    /**
     * Delete a board record
     */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Verify ownership
        const records = await getUserBoardRecords(ctx.user.id);
        if (!records.find(r => r.id === input.id)) {
          throw new Error("Unauthorized");
        }
        return deleteBoardRecord(input.id);
      }),

    /**
     * Generate achievement text using LLM
     */
    generateAchievementText: protectedProcedure
      .input(z.object({ description: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "你是一位專業的醫療文案撰寫師。根據護理師的簡短描述，產生一段30字以內、溫暖且專業的優良事蹟文案。文案應該突出護理工作的關愛與專業精神。",
            },
            {
              role: "user",
              content: `請根據以下描述，產生30字以內的優良事蹟文案：${input.description}`,
            },
          ],
        });
        const content = response.choices[0]?.message?.content;
        let text = "";
        if (typeof content === "string") {
          text = content;
        }
        // Ensure text is max 30 characters
        return text.substring(0, 30);
      }),

    /**
     * Upload board image and photo to Google Drive
     */
    uploadToGoogleDrive: protectedProcedure
      .input(
        z.object({
          boardImageUrl: z.string(),
          photoUrl: z.string().optional(),
          boardId: z.number(),
          name: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { uploadToGoogleDrive: uploadFile } = await import(
          "./_core/googleDriveHandler"
        );

        try {
          const uploadedFiles = [];
          const errors = [];

          // Upload board image (data URL) to Google Drive
          if (input.boardImageUrl) {
            try {
              const boardFileName = `nurse-board-${input.name}-${Date.now()}.png`;
              const { fileId: boardFileId, url: boardUrl } = await uploadFile(
                input.boardImageUrl,
                boardFileName,
                "image/png"
              );
              uploadedFiles.push({ name: boardFileName, fileId: boardFileId, url: boardUrl });
            } catch (error) {
              console.error("Error uploading board image:", error);
              errors.push("看板圖檔上傳失敗");
            }
          }

          // Upload photo if provided (assumes photoUrl is S3 URL)
          if (input.photoUrl) {
            try {
              const photoFileName = `photo-${input.name}-${Date.now()}.jpg`;
              const { fileId: photoFileId, url: photoUrl } = await uploadFile(
                input.photoUrl,
                photoFileName,
                "image/jpeg"
              );
              uploadedFiles.push({ name: photoFileName, fileId: photoFileId, url: photoUrl });
            } catch (error) {
              console.error("Error uploading photo:", error);
              errors.push("照片上傳失敗");
            }
          }

          // If no files were uploaded, throw error
          if (uploadedFiles.length === 0) {
            throw new Error(errors.length > 0 ? errors.join(", ") : "未能上傳任何檔案");
          }

          // Update board record with Google Drive URLs
          const { updateBoardRecord } = await import("./db");
          await updateBoardRecord(input.boardId, {
            boardImageUrl: uploadedFiles.find((f) => f.name.includes("nurse-board"))?.url,
          });

          return { success: true, uploadedFiles, errors };
        } catch (error) {
          console.error("Google Drive upload error:", error);
          throw new Error(error instanceof Error ? error.message : "Failed to upload to Google Drive");
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
