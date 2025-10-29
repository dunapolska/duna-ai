"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { Mistral } from "@mistralai/mistralai";

export const extractText = action({
  args: {
    source: v.object({ fileId: v.id("_storage"), mimeType: v.string() }),
  },
  returns: v.object({ text: v.string() }),
  handler: async (ctx, args) => {
    const blob = await ctx.storage.get(args.source.fileId);
    if (!blob) {
      return { text: "" };
    }
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${args.source.mimeType};base64,${base64}`;

    const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

    // Używamy Document AI OCR: mistral-ocr-latest (Markdown output)
    const ocr = await client.ocr.process({
      model: "mistral-ocr-latest",
      document: {
        type: "document_url",
        documentUrl: dataUrl,
      },
      includeImageBase64: false,
    });

    // Łączymy treści stron do jednego stringa (markdown)
    const text: string = Array.isArray(ocr.pages)
      ? ocr.pages.map((p: any) => p.markdown ?? "").join("\n\n")
      : "";
    return { text };
  },
});


