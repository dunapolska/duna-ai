"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export const generateSummary = internalAction({
  args: {
    text: v.string(),
    sentences: v.optional(v.number()),
    language: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (_ctx, { text, sentences, language }) => {
    const maxChars = 200_000; // safety clip
    const clipped = text.slice(0, maxChars);
    const targetSentences = Math.min(Math.max(sentences ?? 5, 3), 7);
    const lang = language ?? "pl";
    const system = `Streszczaj dokumenty zwięźle i rzeczowo w ${targetSentences} zdaniach. Zwracaj wyłącznie czysty tekst, bez list, bez nagłówków.`;
    const prompt = `Język: ${lang}
Stwórz zwięzłe streszczenie całego dokumentu w ${targetSentences} zdaniach. Unikaj ogólników, skup się na konkretach.

Tekst do streszczenia (ucięty):\n\n${clipped}`;
    try {
      const { text: out } = await generateText({
        model: openai.chat("gpt-4o-mini"),
        system,
        prompt,
        temperature: 0.2,
      });
      return out.trim();
    } catch {
      // Fallback: pierwsze zdania z dokumentu sklejone do limitu
      const safe = clipped.split(/(?<=[.!?])\s+/).slice(0, targetSentences).join(" ").trim();
      return safe || clipped.slice(0, 600);
    }
  },
});


