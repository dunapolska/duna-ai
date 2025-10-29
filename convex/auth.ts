import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

export async function requireUser(
  ctx: ActionCtx | MutationCtx | QueryCtx
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity.subject;
}

export async function authorizeThreadAccess(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  _threadId: string
): Promise<void> {
  // Minimal: wymagamy zalogowanego użytkownika.
  // Rozszerz w przyszłości o sprawdzanie właściciela/uczestników wątku.
  await requireUser(ctx);
}


