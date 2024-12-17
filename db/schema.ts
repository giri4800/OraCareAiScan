import {
  pgTable,
  text,
  serial,
  timestamp,
  uuid,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firebaseId: text("firebase_id").unique().notNull(),
  email: text("email").unique().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const analyses = pgTable("analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => users.firebaseId).notNull(),
  imageUrl: text("image_url").notNull(),
  result: text("result").notNull(),
  confidence: decimal("confidence", { precision: 4, scale: 3 }).notNull(),
  explanation: text("explanation").notNull(),
  recommendations: text("recommendations"),
  severity: text("severity").notNull(),
  status: text("status").notNull().default('pending'),
  patientNotes: text("patient_notes"),
  followUpDate: timestamp("follow_up_date"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertAnalysisSchema = createInsertSchema(analyses);
export const selectAnalysisSchema = createSelectSchema(analyses);

export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;
export type InsertAnalysis = typeof analyses.$inferInsert;
export type SelectAnalysis = typeof analyses.$inferSelect;
