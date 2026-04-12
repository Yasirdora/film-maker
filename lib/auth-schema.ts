/**
 * Drizzle schema for Better Auth tables.
 *
 * This file exists ONLY because Better Auth's Drizzle adapter needs typed
 * table definitions to generate its queries. It is NOT used anywhere else
 * in Film-maker — all app-owned tables are accessed via raw D1 SQL.
 *
 * The column names and JS field names here MUST match exactly:
 *   • the SQL column names in `migrations/0001_init.sql` (first arg to
 *     text() / integer())
 *   • Better Auth's internal field names (the JS property keys) — these
 *     are camelCase counterparts of the SQL columns
 *
 * If you change this file, mirror the change in the SQL migration and
 * verify by running:
 *   npm run db:migrate:local
 *
 * Regenerating from scratch:
 *   npx @better-auth/cli generate
 * (run after edits to lib/auth.ts to detect drift)
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ─── user ───────────────────────────────────────────────────────────────────
export const user = sqliteTable("user", {
    id: text("id").primaryKey(),
    name: text("name"),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" })
        .notNull()
        .default(false),
    image: text("image"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// ─── session ────────────────────────────────────────────────────────────────
export const session = sqliteTable("session", {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
});

// ─── account (OAuth providers + credentials) ───────────────────────────────
export const account = sqliteTable("account", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
        mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
        mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// ─── verification (short-lived tokens: magic links, email OTPs, etc.) ─────
export const verification = sqliteTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// ─── schema export — passed to drizzleAdapter(db, { schema: authSchema }) ──
export const authSchema = { user, session, account, verification };
