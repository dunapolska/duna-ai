import { RAG, contentHashFromArrayBuffer } from "@convex-dev/rag";
import { components } from "./_generated/api";
import { openai } from "@ai-sdk/openai";
import type { Id } from "./_generated/dataModel";

export type Filters = { filename: string; category: string | null };
export type Metadata = { storageId: Id<"_storage">; uploadedBy: string };

// Using any-cast because components may not be present in types until Convex builds generated API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const rag = new RAG<Filters, Metadata>(components.rag, {
  filterNames: ["filename", "category"],
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  embeddingDimension: 1536,
});

export { contentHashFromArrayBuffer };


