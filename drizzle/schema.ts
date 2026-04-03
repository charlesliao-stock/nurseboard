import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Board records table for storing generated nurse recognition boards.
 * Each record contains user info, achievement description, photo URL, and template choice.
 */
export const boardRecords = mysqlTable("board_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  theme: varchar("theme", { length: 255 }).default("2026優良護理人員").notNull(),
  department: varchar("department", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  achievement: text("achievement").notNull(), // Max 30 characters
  photoUrl: text("photoUrl"),
  templateId: int("templateId").default(1).notNull(), // 1-10 for 10 templates
  boardImageUrl: text("boardImageUrl"), // URL to exported board image
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BoardRecord = typeof boardRecords.$inferSelect;
export type InsertBoardRecord = typeof boardRecords.$inferInsert;

/**
 * Theme settings table for managing board theme title.
 * Allows admin to customize the default theme title.
 */
export const themeSettings = mysqlTable("theme_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ThemeSetting = typeof themeSettings.$inferSelect;
export type InsertThemeSetting = typeof themeSettings.$inferInsert;