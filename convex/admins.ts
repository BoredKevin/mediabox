import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Internal query to check if an API token is valid.
 * Checks environment variables (APP_API_TOKEN or MEDIABOX_API_TOKEN) and the apiTokens table.
 */
export const checkApiToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const trimmed = args.token.trim();
    if (!trimmed) return false;

    const envToken = process.env.APP_API_TOKEN || process.env.MEDIABOX_API_TOKEN;
    if (envToken && trimmed === envToken.trim()) {
      return true;
    }

    const found = await ctx.db
      .query("apiTokens")
      .withIndex("by_token", (q) => q.eq("token", trimmed))
      .first();
    return !!found;
  },
});

/**
 * Public query to verify if an API token is valid (used by TV and remote client UI).
 */
export const verifyApiToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const trimmed = args.token.trim();
    if (!trimmed) return { valid: false };

    const envToken = process.env.APP_API_TOKEN || process.env.MEDIABOX_API_TOKEN;
    if (envToken && trimmed === envToken.trim()) {
      return { valid: true };
    }

    const found = await ctx.db
      .query("apiTokens")
      .withIndex("by_token", (q) => q.eq("token", trimmed))
      .first();
    return { valid: !!found };
  },
});

/**
 * Lists registered API tokens (Admin only).
 */
export const listApiTokens = query({
  args: { callerUid: v.string() },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_uid", (q) => q.eq("uid", args.callerUid))
      .first();
    if (!admin) return [];
    return await ctx.db.query("apiTokens").collect();
  },
});

/**
 * Creates an authorized API token in the database.
 */
export const addApiToken = mutation({
  args: {
    callerUid: v.string(),
    token: v.string(),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_uid", (q) => q.eq("uid", args.callerUid))
      .first();
    if (!admin) throw new Error("Unauthorized to add API token");

    const trimmed = args.token.trim();
    if (!trimmed) throw new Error("Token cannot be empty");

    const existing = await ctx.db
      .query("apiTokens")
      .withIndex("by_token", (q) => q.eq("token", trimmed))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        label: args.label ?? existing.label,
      });
      return existing._id;
    }

    return await ctx.db.insert("apiTokens", {
      token: trimmed,
      label: args.label || "API Token",
      createdAt: Date.now(),
    });
  },
});

/**
 * Revokes an API token from the database.
 */
export const revokeApiToken = mutation({
  args: {
    callerUid: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_uid", (q) => q.eq("uid", args.callerUid))
      .first();
    if (!admin) throw new Error("Unauthorized to revoke API token");

    const trimmed = args.token.trim();
    const existing = await ctx.db
      .query("apiTokens")
      .withIndex("by_token", (q) => q.eq("token", trimmed))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/**
 * Internal mutation to generate a cryptographically random API token,
 * insert it into the apiTokens table, and return the created record.
 * Can be run from the Convex dashboard, CLI (npx convex run internal.admins.generateApiToken),
 * or other server-side functions.
 */
export const generateApiToken = internalMutation({
  args: {
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Generate 24 random bytes (48 hex chars)
    const randomBytes = new Uint8Array(24);
    crypto.getRandomValues(randomBytes);
    const hex = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const token = `mbx_${hex}`;

    const now = Date.now();
    const label = args.label?.trim() || "Generated API Token";

    const id = await ctx.db.insert("apiTokens", {
      token,
      label,
      createdAt: now,
    });

    return {
      id,
      token,
      label,
      createdAt: now,
    };
  },
});

/**
 * Lists all administrators.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("admins").collect();
  },
});

/**
 * Checks if a user UID has admin rights.
 */
export const isAdmin = query({
  args: { uid: v.string() },
  handler: async (ctx, args) => {
    if (!args.uid) return false;
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_uid", (q) => q.eq("uid", args.uid))
      .first();
    return !!admin;
  },
});

/**
 * Adds an admin.
 */
export const addAdmin = mutation({
  args: {
    uid: v.string(),
    callerUid: v.string(),
    note: v.optional(v.string()),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("admins")
      .withIndex("by_uid", (q) => q.eq("uid", args.uid))
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("admins", {
      uid: args.uid,
      addedAt: Date.now(),
      role: args.role,
      note: args.note,
    });
  },
});

/**
 * Removes an admin.
 */
export const removeAdmin = mutation({
  args: {
    targetUid: v.string(),
    callerUid: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("admins")
      .withIndex("by_uid", (q) => q.eq("uid", args.targetUid))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
