import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const _setStatus = internalMutation({
  args: {
    uploadId: v.id("uploads"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("error")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.uploadId, { status: args.status });
    return null;
  },
});

export const _setError = internalMutation({
  args: { uploadId: v.id("uploads"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.uploadId, { status: "error", error: args.error });
    return null;
  },
});

export const _getUpload = internalQuery({
  args: { uploadId: v.id("uploads") },
  returns: v.union(
    v.object({
      storageId: v.id("_storage"),
      filename: v.string(),
      mimeType: v.string(),
      category: v.union(v.literal("global"), v.literal("project")),
      projectId: v.optional(v.id("projects")),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const rec = await ctx.db.get(args.uploadId);
    if (!rec) return null;
    return {
      storageId: rec.storageId,
      filename: rec.filename,
      mimeType: rec.mimeType,
      category: rec.category,
      projectId: rec.projectId,
    } as any;
  },
});


