import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { rag } from "./ragClient";
import { requireUser } from "./auth";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("projects"),
      name: v.string(),
    })
  ),
  handler: async (ctx) => {
    await requireUser(ctx);
    const rows = await ctx.db.query("projects").collect();
    return rows.map((r) => ({ _id: r._id, name: r.name }));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    contractor: v.optional(v.string()),
  },
  returns: v.object({ projectId: v.id("projects") }),
  handler: async (ctx, args) => {
    await requireUser(ctx);
    let projectId: any;
    try {
      projectId = await ctx.db.insert("projects", {
        name: args.name,
        description: args.description,
        contractor: args.contractor,
        createdAt: Date.now(),
      });
      // 2) Przygotowanie treści do indeksacji w RAG (projects_index)
      const source = `${args.name} ${args.description ?? ""}`;
      const roadMatches = source.match(/\b(?:S|A|DK)\s?-?\s?\d{1,3}\b/gi) ?? [];
      const kwSet = new Set<string>();
      for (const m of roadMatches) {
        const upper = m.toUpperCase().replace(/\s+/g, "");
        const prefix = upper.match(/^[A-Z]+/)?.[0] ?? "";
        const number = upper.replace(/^[A-Z]+/, "");
        if (!prefix || !number) continue;
        kwSet.add(`${prefix}${number}`);
        kwSet.add(`${prefix}-${number}`);
        kwSet.add(`${prefix} ${number}`);
      }
      const keywords = Array.from(kwSet);

      const text = `Nazwa projektu: ${args.name}\nKontrahent: ${args.contractor ?? ""}\nOpis: ${args.description ?? ""}${
        keywords.length ? `\nSłowa kluczowe: ${keywords.join(", ")}` : ""
      }`;

      // 2-3) Indeksacja + update rag_entry_id wykonywane w akcji wewnętrznej
      await ctx.scheduler.runAfter(0, internal.projects._indexProject, {
        projectId,
        text,
      });

      return { projectId } as { projectId: any };
    } catch (error) {
      // próba sprzątnięcia w wypadku błędu (mutacja i tak się wycofa przy throw)
      if (projectId) {
        try {
          await ctx.db.delete(projectId);
        } catch {}
      }
      throw error;
    }
  },
});

// Internal glue: action do indeksacji oraz mutacja do ustawienia rag_entry_id
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";

export const _setProjectRagEntryId = internalMutation({
  args: {
    projectId: v.id("projects"),
    ragEntryId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, { rag_entry_id: args.ragEntryId });
    return null;
  },
});

export const _indexProject = internalAction({
  args: {
    projectId: v.id("projects"),
    text: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const res = await rag.add(ctx, {
      namespace: "projects",
      text: args.text,
    });
    if (res?.entryId) {
      await ctx.runMutation(internal.projects._setProjectRagEntryId, {
        projectId: args.projectId,
        ragEntryId: res.entryId,
      });
    }
    return null;
  },
});

export const _getRagEntryId = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    return project?.rag_entry_id ?? null;
  },
});

export const _searchProjects = internalQuery({
  args: { query: v.string() },
  returns: v.array(v.object({ _id: v.id("projects"), name: v.string() })),
  handler: async (ctx, args) => {
    const projects = await ctx.db
      .query("projects")
      .withSearchIndex("name", (q) => q.search("name", args.query))
      .collect();
    return projects.map((p) => ({ _id: p._id, name: p.name }));
  },
});
