import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const boardRoleEnum = ["owner", "editor", "viewer"] as const;
export type BoardRole = (typeof boardRoleEnum)[number];

export const boardsTable = pgTable("boards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  ownerId: varchar("owner_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  elements: jsonb("elements").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const boardCollaboratorsTable = pgTable("board_collaborators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: varchar("board_id")
    .notNull()
    .references(() => boardsTable.id, { onDelete: "cascade" }),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("editor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const boardChatMessagesTable = pgTable("board_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: varchar("board_id")
    .notNull()
    .references(() => boardsTable.id, { onDelete: "cascade" }),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBoardSchema = createInsertSchema(boardsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBoard = z.infer<typeof insertBoardSchema>;
export type Board = typeof boardsTable.$inferSelect;

export const insertBoardCollaboratorSchema = createInsertSchema(boardCollaboratorsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBoardCollaborator = z.infer<typeof insertBoardCollaboratorSchema>;
export type BoardCollaborator = typeof boardCollaboratorsTable.$inferSelect;

export const insertBoardChatMessageSchema = createInsertSchema(boardChatMessagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBoardChatMessage = z.infer<typeof insertBoardChatMessageSchema>;
export type BoardChatMessage = typeof boardChatMessagesTable.$inferSelect;
