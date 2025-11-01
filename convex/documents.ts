import { mutation, action, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { rag } from "./ragClient";
import { requireUser } from "./auth";

export const deleteDocument = mutation({
  args: { documentId: v.id("documents") },
  returns: v.null(),
  handler: async (ctx, { documentId }) => {
    await requireUser(ctx);
    // Orkiestracja kasowania przeniesiona do akcji (mutacje nie mogą wołać akcji bezpośrednio)
    await ctx.scheduler.runAfter(0, api.documents.removeDocument, { documentId });
    return null;
  },
});

import { query } from "./_generated/server";

export const listGlobal = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("documents"),
      filename: v.string(),
      title: v.string(),
      type: v.optional(v.string()),
      document_number: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("done"),
        v.literal("duplicate"),
        v.literal("error")
      ),
      error: v.optional(v.string()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    await requireUser(ctx);
    // Note: using filter since schema doesn't provide index by type
    const rows = await ctx.db
      .query("documents")
      .order("desc")
      .filter((q) => q.eq(q.field("type"), "global"))
      .collect();
    return rows.map((d: any) => ({
      _id: d._id,
      filename: d.filename,
      title: d.title,
      type: d.type,
      document_number: d.document_number,
      status: d.status,
      error: d.error,
      createdAt: d.createdAt,
    }));
  },
});

export const listProjectDocs = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("documents"),
      project_id: v.id("projects"),
      filename: v.string(),
      title: v.string(),
      type: v.optional(v.string()),
      document_number: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("done"),
        v.literal("duplicate"),
        v.literal("error")
      ),
      error: v.optional(v.string()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const rows = await ctx.db
      .query("documents")
      .withIndex("by_project_and_filename", (q) => q.eq("project_id", args.projectId))
      .order("desc")
      .collect();
    return rows
      .filter((d: any) => d.type === "project")
      .map((d: any) => ({
        _id: d._id,
        project_id: d.project_id,
        filename: d.filename,
        title: d.title,
        type: d.type,
        document_number: d.document_number,
        status: d.status,
        error: d.error,
        createdAt: d.createdAt,
      }));
  },
});

export const listAllProjectDocs = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("documents"),
      project_id: v.id("projects"),
      filename: v.string(),
      title: v.string(),
      type: v.optional(v.string()),
      document_number: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("done"),
        v.literal("duplicate"),
        v.literal("error")
      ),
      error: v.optional(v.string()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    await requireUser(ctx);
    const rows = await ctx.db.query("documents").order("desc").collect();
    return rows
      .filter((d: any) => d.type === "project")
      .map((d: any) => ({
        _id: d._id,
        project_id: d.project_id,
        filename: d.filename,
        title: d.title,
        type: d.type,
        document_number: d.document_number,
        status: d.status,
        error: d.error,
        createdAt: d.createdAt,
      }));
  },
});

// Internal helpers for deletion flow
export const _getDocForDelete = internalQuery({
  args: { documentId: v.id("documents") },
  returns: v.union(
    v.object({
      _id: v.id("documents"),
      rag_entry_id: v.optional(v.string()),
      storageId: v.optional(v.id("_storage")),
    }),
    v.null()
  ),
  handler: async (ctx, { documentId }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc) return null;
    const storageId = doc?.metadata?.storageId ?? undefined;
    return { _id: doc._id, rag_entry_id: doc.rag_entry_id, storageId } as any;
  },
});

export const _deleteDocumentDb = internalMutation({
  args: { documentId: v.id("documents") },
  returns: v.null(),
  handler: async (ctx, { documentId }) => {
    await ctx.db.delete(documentId);
    return null;
  },
});

export const removeDocument = action({
  args: { documentId: v.id("documents") },
  returns: v.null(),
  handler: async (ctx, { documentId }) => {
    await requireUser(ctx);
    const doc = await ctx.runQuery(internal.documents._getDocForDelete, { documentId });
    if (!doc) throw new Error("Document not found");

    // 1) Remove from RAG (soft-fail on 404)
    if (doc.rag_entry_id) {
      try {
        await rag.delete?.(ctx, { entryId: doc.rag_entry_id });
      } catch (e: any) {
        // ignoruj inne błędy, kontynuuj kasowanie
      }
    }

    // 2) Remove storage file if present
    if (doc.storageId) {
      try {
        await ctx.storage.delete(doc.storageId);
      } catch (e) {
        // ignore storage delete errors
      }
    }

    // 3) Remove DB record
    await ctx.runMutation(internal.documents._deleteDocumentDb, { documentId });
    return null;
  },
});


