import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, BoardRecord, InsertBoardRecord, ThemeSetting, boardRecords, themeSettings } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get all board records for a user
 */
export async function getUserBoardRecords(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get board records: database not available");
    return [];
  }

  try {
    const result = await db
      .select()
      .from(boardRecords)
      .where(eq(boardRecords.userId, userId))
      .orderBy(desc(boardRecords.createdAt));
    return result;
  } catch (error) {
    console.error("[Database] Failed to get board records:", error);
    throw error;
  }
}

/**
 * Create a new board record
 */
export async function createBoardRecord(record: InsertBoardRecord): Promise<BoardRecord | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create board record: database not available");
    return null;
  }

  try {
    const result = await db.insert(boardRecords).values(record);
    const id = result[0].insertId;
    const created = await db.select().from(boardRecords).where(eq(boardRecords.id, Number(id))).limit(1);
    return created.length > 0 ? created[0] : null;
  } catch (error) {
    console.error("[Database] Failed to create board record:", error);
    throw error;
  }
}

/**
 * Update a board record
 */
export async function updateBoardRecord(id: number, updates: Partial<InsertBoardRecord>): Promise<BoardRecord | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update board record: database not available");
    return null;
  }

  try {
    await db.update(boardRecords).set(updates).where(eq(boardRecords.id, id));
    const result = await db.select().from(boardRecords).where(eq(boardRecords.id, id)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to update board record:", error);
    throw error;
  }
}

/**
 * Delete a board record
 */
export async function deleteBoardRecord(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete board record: database not available");
    return false;
  }

  try {
    await db.delete(boardRecords).where(eq(boardRecords.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete board record:", error);
    throw error;
  }
}

/**
 * Get theme setting by key
 */
export async function getThemeSetting(key: string): Promise<ThemeSetting | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get theme setting: database not available");
    return null;
  }

  try {
    const result = await db.select().from(themeSettings).where(eq(themeSettings.key, key)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get theme setting:", error);
    throw error;
  }
}

/**
 * Set or update theme setting
 */
export async function setThemeSetting(key: string, value: string, description?: string): Promise<ThemeSetting | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot set theme setting: database not available");
    return null;
  }

  try {
    const existing = await getThemeSetting(key);
    if (existing) {
      await db.update(themeSettings).set({ value, description }).where(eq(themeSettings.key, key));
    } else {
      await db.insert(themeSettings).values({ key, value, description });
    }
    return getThemeSetting(key);
  } catch (error) {
    console.error("[Database] Failed to set theme setting:", error);
    throw error;
  }
}


