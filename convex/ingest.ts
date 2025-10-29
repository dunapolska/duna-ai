import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { rag, contentHashFromArrayBuffer } from "./ragClient";

function canonicalizeFilename(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}


// Funkcja normalizacji tekstu dla stabilnego contentHash
function normalizeTextForHash(text: string): string {
  return text
    // Usuń wszystkie białe znaki i zastąp pojedynczymi spacjami
    .replace(/\s+/g, ' ')
    // Usuń znaki końca linii i tabulatory
    .replace(/[\n\r\t]/g, ' ')
    // Usuń wielokrotne spacje
    .replace(/\s{2,}/g, ' ')
    // Usuń spacje na początku i końcu
    .trim()
    // Zamień na małe litery dla lepszej porównywalności
    .toLowerCase()
    // Usuń znaki interpunkcyjne które mogą się różnić w OCR
    .replace(/[^\w\s]/g, ' ')
    // Usuń wielokrotne spacje ponownie
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export const upsertDocument = action({
  args: {
    type: v.union(v.literal("global"), v.literal("project")),
    projectId: v.optional(v.id("projects")),
    filename: v.string(),
    title: v.string(),
    text: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    mimeType: v.optional(v.string()),
  },
  returns: v.object({ documentId: v.id("documents") }),
  handler: async (ctx, args) => {
    const filenameCanonical = canonicalizeFilename(args.filename);
    // 1) Upewnij się, że stub istnieje i ustaw status processing
    const prepared = await ctx.runMutation(internal.ingest._prepareUnifiedDocument, {
      type: args.type,
      projectId: args.projectId ?? null,
      filename: filenameCanonical,
      title: args.title,
    });
    const documentId = prepared.documentId as Id<"documents">;
    try {
      // Pobierz metadane dokumentu
      const doc = await ctx.runQuery(internal.ingest._getUnifiedDocumentSha256, {
        documentId,
      });

      // 2) Wyciągnij tekst - tylko PDF z OCR
      let text = args.text || "";
      let processingType = "Document";
      
      if (args.storageId && args.filename.toLowerCase().endsWith('.pdf')) {
        console.log(`[PDF Processing] 🔍 Przetwarzam PDF przez OCR - ${filenameCanonical}`);
        const res = await ctx.runAction(api.ocr.extractText, {
          source: { fileId: args.storageId, mimeType: "application/pdf" },
        });
        text = res.text || "";
        processingType = "OCR";
      }

      // 3) Namespace
      let namespace = "global";
      if (args.type === "project") {
        const projectRagEntryId = await ctx.runQuery(internal.projects._getRagEntryId, {
          projectId: args.projectId as Id<"projects">,
        });
        if (!projectRagEntryId) {
          throw new Error("Brak rag_entry_id dla projektu; indeksacja dokumentu niemożliwa");
        }
        namespace = projectRagEntryId;
      }

      // 4) Normalizuj tekst przed obliczeniem contentHash
      const normalizedText = normalizeTextForHash(text);
      const textBuffer = new TextEncoder().encode(normalizedText);
      const contentHash = await contentHashFromArrayBuffer(textBuffer.buffer);
      
      console.log(`[${processingType} Processing] Analiza dokumentu:`, {
        filename: filenameCanonical,
        originalLength: text.length,
        normalizedLength: normalizedText.length,
        compressionRatio: (normalizedText.length / text.length * 100).toFixed(1) + '%',
        originalPreview: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
        normalizedPreview: normalizedText.substring(0, 100) + (normalizedText.length > 100 ? "..." : ""),
        markdownElements: {
          headers: (text.match(/^#+\s/gm) || []).length,
          lists: (text.match(/^[\s]*[-*+]\s/gm) || []).length,
          codeBlocks: (text.match(/```/g) || []).length / 2,
          links: (text.match(/\[.*?\]\(.*?\)/g) || []).length
        }
      });
      

      // 5) Dodaj pełen tekst do RAG z contentHash (używamy znormalizowanego tekstu tylko dla hash)
      const addRes = await rag.add(ctx, {
        namespace,
        text: text, // Zachowujemy oryginalny tekst dla RAG
        key: filenameCanonical,
        title: filenameCanonical,
        metadata:
          doc && (doc as any).storageId
            ? { storageId: (doc as any).storageId, uploadedBy: "system" }
            : args.storageId
            ? { storageId: args.storageId, uploadedBy: "system" }
            : undefined,
        contentHash: contentHash, // Hash z znormalizowanego tekstu
      });
      if (!addRes?.entryId) throw new Error("rag.add nie zwróciło entryId");
      
      console.log(`[${processingType} Processing] RAG add result:`, {
        filename: filenameCanonical,
        entryId: addRes.entryId,
        created: (addRes as any).created,
        isDuplicate: (addRes as any).created === false
      });

      // Jeżeli wpis już istniał, oznacz jako duplikat i usuń plik ze storage
      if (addRes && (addRes as any).created === false) {
        console.log(`[${processingType} Processing] 🔄 Znaleziono duplikat po contentHash - ${filenameCanonical}`);
        await ctx.runMutation(internal.ingest._finalizeUnifiedDocument, {
          documentId,
          ragEntryId: addRes.entryId,
          status: "duplicate",
        });

        if ((doc as any)?.storageId) {
          try {
            await ctx.storage.delete((doc as any).storageId);
          } catch (e) {
            // ignoruj błędy usuwania pliku
          }
        }
        return { documentId } as any;
      }

      // 6) Zapisz rag_entry_id dokumentu i oznacz done
      console.log(`[${processingType} Processing] ✅ Dokument pomyślnie dodany do RAG - ${filenameCanonical}`);
      await ctx.runMutation(internal.ingest._finalizeUnifiedDocument, {
        documentId,
        ragEntryId: addRes.entryId,
        status: "done",
      });

      return { documentId } as any;
    } catch (e: any) {
      await ctx.runMutation(internal.ingest._finalizeUnifiedDocument, {
        documentId,
        status: "error",
        error: e?.message ?? String(e),
      });
      return { documentId } as any;
    }
  },
});

export const _prepareUnifiedDocument = internalMutation({
  args: {
    type: v.union(v.literal("global"), v.literal("project")),
    projectId: v.optional(v.union(v.id("projects"), v.null())),
    filename: v.string(),
    title: v.string(),
  },
  returns: v.object({ documentId: v.id("documents") }),
  handler: async (ctx, args) => {
    const filenameCanonical = canonicalizeFilename(args.filename);
    if (args.type === "project" && args.projectId) {
      const existing = await ctx.db
        .query("documents")
        .withIndex("by_project_and_filename", (q) =>
          q.eq("project_id", args.projectId as any).eq("filename", filenameCanonical)
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          title: args.title,
          status: "processing",
          error: undefined,
        });
        return { documentId: existing._id } as any;
      }
    } else {
      const existing = await ctx.db
        .query("documents")
        .withIndex("by_filename", (q) => q.eq("filename", filenameCanonical))
        .unique();
      if (existing && existing.type === "global") {
        await ctx.db.patch(existing._id, {
          title: args.title,
          status: "processing",
          error: undefined,
        });
        return { documentId: existing._id } as any;
      }
    }

    const documentId = await ctx.db.insert("documents", {
      type: args.type,
      project_id: args.type === "project" ? (args.projectId as any) : undefined,
      filename: filenameCanonical,
      title: args.title,
      createdAt: Date.now(),
      status: "processing",
    } as any);
    return { documentId } as any;
  },
});

export const _getUnifiedDocumentSha256 = internalQuery({
  args: {
    documentId: v.id("documents"),
  },
  returns: v.union(
    v.object({
      sha256: v.optional(v.string()),
      storageId: v.optional(v.id("_storage")),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) return null;
    const storageId = (document as any)?.metadata?.storageId;
    return { sha256: (document as any).sha256, storageId } as any;
  },
});

export const _finalizeUnifiedDocument = internalMutation({
  args: {
    documentId: v.id("documents"),
    ragEntryId: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("duplicate"),
      v.literal("error")
    ),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      rag_entry_id: args.ragEntryId,
      status: args.status,
      error: args.error,
    });
    return null;
  },
});

// Funkcja do naprawienia dokumentów utkniętych w statusie "processing"
export const fixStuckDocuments = action({
  args: {},
  returns: v.object({ 
    fixed: v.number(),
    errors: v.array(v.string())
  }),
  handler: async (ctx, args) => {
    const errors: string[] = [];
    let fixed = 0;
    
    try {
      // Znajdź wszystkie dokumenty w statusie "processing"
      const stuckDocs = await ctx.runQuery(internal.ingest._getStuckDocuments, {});
      
      console.log(`[Fix Stuck Documents] Znaleziono ${stuckDocs.length} dokumentów w statusie "processing"`);
      
      for (const doc of stuckDocs) {
        try {
          // Sprawdź czy plik istnieje w storage
          const storageId = (doc as any)?.metadata?.storageId;
          if (!storageId) {
            console.log(`[Fix Stuck Documents] Brak storageId dla dokumentu ${doc.filename}`);
            await ctx.runMutation(internal.ingest._finalizeUnifiedDocument, {
              documentId: doc._id,
              status: "error",
              error: "Brak storageId - plik nie został znaleziony",
            });
            fixed++;
            continue;
          }
          
          const blob = await ctx.storage.get(storageId);
          if (!blob) {
            console.log(`[Fix Stuck Documents] Plik nie istnieje w storage dla ${doc.filename}`);
            await ctx.runMutation(internal.ingest._finalizeUnifiedDocument, {
              documentId: doc._id,
              status: "error",
              error: "Plik nie istnieje w storage",
            });
            fixed++;
            continue;
          }
          
          // Sprawdź czy to PDF i spróbuj ponownie przetworzyć
          if (doc.filename.toLowerCase().endsWith('.pdf')) {
            console.log(`[Fix Stuck Documents] Ponowne przetwarzanie PDF: ${doc.filename}`);
            await ctx.runAction(api.ingest.upsertDocument, {
              type: doc.type,
              projectId: doc.project_id,
              filename: doc.filename,
              title: doc.title,
              storageId,
              mimeType: "application/pdf",
            });
            fixed++;
          } else {
            console.log(`[Fix Stuck Documents] Nieznany typ pliku dla ${doc.filename} - tylko PDF są obsługiwane`);
            await ctx.runMutation(internal.ingest._finalizeUnifiedDocument, {
              documentId: doc._id,
              status: "error",
              error: `Nieznany typ pliku - tylko PDF są obsługiwane`,
            });
            fixed++;
          }
        } catch (e: any) {
          const errorMsg = `Błąd przy naprawianiu ${doc.filename}: ${e?.message ?? String(e)}`;
          console.error(`[Fix Stuck Documents] ${errorMsg}`);
          errors.push(errorMsg);
          
          // Oznacz jako błąd
          await ctx.runMutation(internal.ingest._finalizeUnifiedDocument, {
            documentId: doc._id,
            status: "error",
            error: errorMsg,
          });
          fixed++;
        }
      }
      
      console.log(`[Fix Stuck Documents] ✅ Naprawiono ${fixed} dokumentów, ${errors.length} błędów`);
      return { fixed, errors };
    } catch (e: any) {
      console.error(`[Fix Stuck Documents] Błąd ogólny: ${e?.message ?? String(e)}`);
      return { fixed: 0, errors: [e?.message ?? String(e)] };
    }
  },
});

export const _getStuckDocuments = internalQuery({
  args: {},
  returns: v.array(v.object({
    _id: v.id("documents"),
    filename: v.string(),
    title: v.string(),
    type: v.union(v.literal("global"), v.literal("project")),
    project_id: v.optional(v.id("projects")),
    status: v.string(),
    metadata: v.optional(v.any()),
  })),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("documents")
      .filter((q) => q.eq(q.field("status"), "processing"))
      .collect();
    
    return docs.map((doc: any) => ({
      _id: doc._id,
      filename: doc.filename,
      title: doc.title,
      type: doc.type,
      project_id: doc.project_id,
      status: doc.status,
      metadata: doc.metadata,
    }));
  },
});
