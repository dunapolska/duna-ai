import { query, mutation, action, internalAction } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { createThread, listUIMessages, vStreamArgs, syncStreams, abortStream, saveMessage } from "@convex-dev/agent";
import { authorizeThreadAccess } from "./auth";
import { appAgent } from "./agent";
import { requireUser } from "./auth";

type ThreadsPage = {
  continueCursor: string;
  isDone: boolean;
  page: Array<{
    _creationTime: number;
    _id: string;
    status: "active" | "archived";
    summary?: string;
    title?: string;
    userId?: string;
  }>;
  pageStatus?: "SplitRecommended" | "SplitRequired" | null;
  splitCursor?: string | null;
};

export const listUserThreads = query({
  args: {
    numItems: v.optional(v.number()),
  },
  // Zwracamy uproszczoną listę wątków użytkownika
  returns: v.array(
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      status: v.union(v.literal("active"), v.literal("archived")),
      title: v.optional(v.string()),
      summary: v.optional(v.string()),
      userId: v.optional(v.string()),
    })
  ),
  handler: async (
    ctx,
    { numItems }
  ): Promise<
    Array<{
      _id: string;
      _creationTime: number;
      status: "active" | "archived";
      title?: string;
      summary?: string;
      userId?: string;
    }>
  > => {
    await requireUser(ctx);
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    const paginated: ThreadsPage = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      {
      userId,
      order: "desc",
      paginationOpts: { numItems: numItems ?? 50, cursor: null },
      }
    );
    return paginated.page;
  },
});

export const createThreadForUser = mutation({
  args: {
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, { title, summary }) => {
    await requireUser(ctx);
    const identity = await ctx.auth.getUserIdentity();
    const threadId = await createThread(ctx, components.agent, {
      userId: identity?.subject,
      title,
      summary,
    });
    return threadId;
  },
});

// Wymuszone utworzenie nowego wątku, nawet jeśli ostatni jest pusty
export const createFreshThreadForUser = mutation({
  args: {
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, { title, summary }) => {
    await requireUser(ctx);
    const identity = await ctx.auth.getUserIdentity();
    const threadId = await createThread(ctx, components.agent, {
      userId: identity?.subject,
      title,
      summary,
    });
    return threadId;
  },
});

export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  // Note: returning paginated UI messages; validator omitted due to complex shape.
  handler: async (ctx, { threadId, paginationOpts }) => {
    await authorizeThreadAccess(ctx, threadId);
    const paginated = await listUIMessages(ctx, components.agent, {
      threadId,
      paginationOpts,
    });
    return paginated;
  },
});

export const listThreadMessagesStreaming = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  // Note: returns combined { ...paginated, streams } used by useUIMessages with stream: true
  handler: async (ctx, { threadId, paginationOpts, streamArgs }) => {
    await authorizeThreadAccess(ctx, threadId);
    const paginated = await listUIMessages(ctx, components.agent, {
      threadId,
      paginationOpts,
    });
    const streams = await syncStreams(ctx, components.agent, {
      threadId,
      streamArgs,
    });
    return { ...paginated, streams };
  },
});

export const generateReplyToPrompt = action({
  args: {
    threadId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, { threadId, prompt }) => {
    await authorizeThreadAccess(ctx, threadId);
    const result = await appAgent.generateText(ctx, { threadId }, { prompt });
    return { text: result.text ?? "" };
  },
});

export const streamReplyToPromptInternal = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { threadId, promptMessageId }) => {
    // Autoryzację wykonujemy w mutacji inicjującej; scheduler nie niesie tożsamości
    await appAgent.streamText(
      ctx,
      { threadId },
      { promptMessageId },
      { saveStreamDeltas: true }
    );
    return null;
  },
});

export const streamReplyToPrompt = action({
  args: {
    threadId: v.string(),
    prompt: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { threadId, prompt }) => {
    await authorizeThreadAccess(ctx, threadId);
    // 1) Zapisz wiadomość usera i pobierz promptMessageId
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt,
    });
    // 2) Uruchom strumień odpowiedzi w tle, referując promptMessageId
    await ctx.scheduler.runAfter(0, internal.chat.streamReplyToPromptInternal, {
      threadId,
      promptMessageId: messageId,
    });
    return null;
  },
});

export const initiateAsyncStreaming = mutation({
  args: {
    threadId: v.string(),
    prompt: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { threadId, prompt }) => {
    await authorizeThreadAccess(ctx, threadId);
    // 1) Zapisz wiadomość usera i pobierz promptMessageId
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt,
    });
    // 2) Uruchom strumień odpowiedzi asystenta w tle na podstawie promptMessageId
    await ctx.scheduler.runAfter(0, internal.chat.streamReplyToPromptInternal, {
      threadId,
      promptMessageId: messageId,
    });
    return null;
  },
});

export const abortStreamByOrder = mutation({
  args: {
    threadId: v.string(),
    order: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { threadId, order }) => {
    await authorizeThreadAccess(ctx, threadId);
    // Signal abort via Agent helper function
    await abortStream(ctx, components.agent, { threadId, order, reason: "user_abort" });
    return null;
  },
});


export const renameThread = mutation({
  args: { threadId: v.string(), title: v.string() },
  returns: v.null(),
  handler: async (ctx, { threadId, title }) => {
    await authorizeThreadAccess(ctx, threadId);
    await ctx.runMutation(components.agent.threads.updateThread, {
      threadId,
      patch: { title },
    });
    return null;
  },
});

export const archiveThread = mutation({
  args: { threadId: v.string() },
  returns: v.null(),
  handler: async (ctx, { threadId }) => {
    await authorizeThreadAccess(ctx, threadId);
    await ctx.runMutation(components.agent.threads.updateThread, {
      threadId,
      patch: { status: "archived" },
    });
    return null;
  },
});



// Zwróć najnowszy pusty wątek użytkownika lub utwórz nowy, jeśli ostatni zawiera wiadomości
export const getLatestEmptyOrCreateThread = mutation({
  args: {
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, { title, summary }) => {
    await requireUser(ctx);
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    // Pobierz najnowszy wątek użytkownika
    const paginated: ThreadsPage = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      {
        userId,
        order: "desc",
        paginationOpts: { numItems: 1, cursor: null },
      }
    );
    const latest = paginated.page[0];
    if (latest) {
      // Sprawdź czy wątek jest pusty (brak wiadomości)
      const page1: any = await listUIMessages(ctx, components.agent, {
        threadId: latest._id,
        paginationOpts: { numItems: 1, cursor: null },
      });
      const hasAny = Array.isArray((page1 as any).page) ? (page1 as any).page.length > 0 : false;
      if (!hasAny) {
        return latest._id;
      }
    }
    // Utwórz nowy wątek, jeśli nie ma żadnego lub ostatni nie jest pusty
    const newId = await createThread(ctx, components.agent, { userId, title, summary });
    return newId;
  },
});

