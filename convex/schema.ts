import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"]),

  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    contractor: v.optional(v.string()),
    createdAt: v.number(),
    rag_entry_id: v.optional(v.string()),
  }).searchIndex("name", {
    searchField: "name",
  }),
  
  documents: defineTable({
    type: v.union(v.literal("global"), v.literal("project")),
    project_id: v.optional(v.id("projects")),
    filename: v.string(),
    title: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("duplicate"),
      v.literal("error")
    ),
    error: v.optional(v.string()),
    createdAt: v.number(),
    rag_entry_id: v.optional(v.string()),
    metadata: v.optional(v.any()),
    document_number: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  })
    .index("by_project_and_filename", ["project_id", "filename"]) // for project documents
    .index("by_filename", ["filename"]), // for global documents and fallback

  rag_insights: defineTable({
    query: v.string(),
    used_namespaces: v.optional(v.array(v.string())),
    sources: v.optional(v.array(v.string())),
    createdAt: v.number(),
  }),

  uploads: defineTable({
    storageId: v.id("_storage"),
    filename: v.string(),
    mimeType: v.string(),
    category: v.union(v.literal("global"), v.literal("project")),
    projectId: v.optional(v.id("projects")),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("error")
    ),
    error: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_status_createdAt", ["status", "createdAt"]),
});


