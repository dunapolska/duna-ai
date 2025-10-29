"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

export const processUpload = internalAction({
  args: { uploadId: v.id("uploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Mark processing
    await ctx.runMutation(internal.jobs_helpers._setStatus, {
      uploadId: args.uploadId,
      status: "processing",
    });

    try {
      const rec = await ctx.runQuery(internal.jobs_helpers._getUpload, {
        uploadId: args.uploadId,
      });
      if (!rec) throw new Error("Upload not found");

      const { storageId, mimeType, filename, category, projectId } = rec;

      let text = "";
      if (mimeType.startsWith("application/pdf")) {
        console.log(`[PDF Processing] 🔍 Przetwarzam PDF przez OCR - ${filename}`);
        const res = await ctx.runAction(api.ocr.extractText, {
          source: { fileId: storageId, mimeType },
        });
        text = res.text || "";
        console.log(`[PDF Processing] OCR zakończone - wyekstrahowano ${text.length} znaków - ${filename}`);
      } else {
        // Tylko PDF są obsługiwane
        throw new Error(`Nieobsługiwany typ pliku: ${mimeType}. Tylko PDF są dozwolone.`);
      }

      const title = filename.replace(/\.[^.]+$/, "");

      if (category === "project") {
        if (!projectId) throw new Error("Missing projectId for project upload");
        await ctx.runAction(api.ingest.upsertDocument, {
          type: "project",
          projectId,
          filename,
          title,
          text,
        });
      } else {
        await ctx.runAction(api.ingest.upsertDocument, {
          type: "global",
          filename,
          title,
          text,
        });
      }

      await ctx.runMutation(internal.jobs_helpers._setStatus, {
        uploadId: args.uploadId,
        status: "done",
      });
      return null;
    } catch (e: any) {
      await ctx.runMutation(internal.jobs_helpers._setError, {
        uploadId: args.uploadId,
        error: e?.message ?? String(e),
      });
      return null;
    }
  },
});
