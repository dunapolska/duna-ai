import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { Workpool } from "@convex-dev/workpool";
import { requireUser } from "./auth";

const uploadPool = new Workpool(components.workpool, {
  maxParallelism: 4,
});

function canonicalizeFilename(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export const generateUploadUrl = mutation({
  args: {},
  returns: v.object({ url: v.string() }),
  handler: async (ctx) => {
    await requireUser(ctx);
    const url = await ctx.storage.generateUploadUrl();
    return { url };
  },
});

export const registerUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    filename: v.string(),
    mimeType: v.string(),
    category: v.union(v.literal("global"), v.literal("project")),
    projectId: v.optional(v.id("projects")),
  },
  returns: v.object({ uploadId: v.id("uploads") }),
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const uploadId = await ctx.db.insert("uploads", {
      storageId: args.storageId,
      filename: args.filename,
      mimeType: args.mimeType,
      category: args.category,
      projectId: args.projectId,
      status: "pending",
      createdAt: Date.now(),
    });

    // Create unified document stub immediately in `documents`
    const title = args.filename.replace(/\.[^.]+$/, "");
    await ctx.runMutation(internal.uploads._createDocumentStub, {
      type: args.category,
      projectId: args.projectId ?? null,
      filename: args.filename,
      title,
      storageId: args.storageId,
      mimeType: args.mimeType,
    });

    await uploadPool.enqueueAction(
      ctx,
      internal.jobs.processUpload,
      { uploadId },
      {
        retry: { maxAttempts: 5, initialBackoffMs: 1000, base: 2 },
      }
    );

    return { uploadId };
  },
});

export const listStatuses = query({
  args: { projectId: v.optional(v.id("projects")) },
  returns: v.array(
    v.object({
      _id: v.id("uploads"),
      filename: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("done"),
        v.literal("error")
      ),
      error: v.optional(v.string()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    await requireUser(ctx);
    let q = ctx.db.query("uploads").order("desc");
    if (args.projectId) {
      q = q.filter((q) => q.eq(q.field("projectId"), args.projectId));
    }
    const rows = await q.collect();
    return rows.map((r) => ({
      _id: r._id,
      filename: r.filename,
      status: r.status,
      error: r.error,
      createdAt: r.createdAt,
    }));
  },
});

export const _createDocumentStub = internalMutation({
  args: {
    type: v.union(v.literal("global"), v.literal("project")),
    projectId: v.optional(v.union(v.id("projects"), v.null())),
    filename: v.string(),
    title: v.string(),
    storageId: v.id("_storage"),
    mimeType: v.string(),
  },
  returns: v.id("documents"),
  handler: async (ctx, args) => {
    const filenameCanonical = canonicalizeFilename(args.filename);

    // Deduplikacja przeniesiona do ingest.upsertDocument (contentHash z tekstu)
    // Tutaj tylko tworzymy stub dokumentu

    // Fallback dedup by filename (canonical) - tylko dla tego samego pliku
    if (args.type === "project" && args.projectId) {
      const existing = await ctx.db
        .query("documents")
        .withIndex("by_project_and_filename", (q) =>
          q.eq("project_id", args.projectId!).eq("filename", filenameCanonical)
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          status: "processing",
          error: undefined,
          metadata: { storageId: args.storageId, mimeType: args.mimeType },
        });
        return existing._id;
      }
    } else {
      const existing = await ctx.db
        .query("documents")
        .withIndex("by_filename", (q) => q.eq("filename", filenameCanonical))
        .unique();
      if (existing && existing.type === "global") {
        await ctx.db.patch(existing._id, {
          status: "processing",
          error: undefined,
          metadata: { storageId: args.storageId, mimeType: args.mimeType },
        });
        return existing._id;
      }
    }

    // Create new document
    return await ctx.db.insert("documents", {
      type: args.type,
      project_id: args.type === "project" ? (args.projectId as any) : undefined,
      filename: filenameCanonical,
      title: args.title,
      createdAt: Date.now(),
      status: "processing",
      metadata: { storageId: args.storageId, mimeType: args.mimeType },
    } as any);
  },
});


