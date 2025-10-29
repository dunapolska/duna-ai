"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, User, Copy as CopyIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UIMessage } from "@convex-dev/agent";
import { useSmoothText } from "@convex-dev/agent/react";
import { Response } from "@/components/ai-elements/response";
import { Actions, Action } from "@/components/ai-elements/actions";
import { Loader } from "@/components/ai-elements/loader";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
} from "@/components/ai-elements/chain-of-thought";

interface ChatMessagesProps {
  messages: UIMessage[];
}

// Przyjazne polskie nazwy dla tool calli
function getToolDisplayName(toolTitleOrType: string): string {
  const map: Record<string, string> = {
    searchProjects: "Wyszukuję projekty",
    searchProjectDocument: "Wyszukuję dokumenty",
    searchProjectDocuments: "Wyszukuję dokumenty",
    vectorSearchDocument: "Przeszukuję zawartość dokumentu",
    searchGlobalDocs: "Wyszukuję w dokumentach globalnych",
    vectorSearchGlobal: "Przeszukuję zawartość dokumentu globalnego",
  };
  return map[toolTitleOrType] ?? toolTitleOrType;
}

export function ChatMessages({ messages }: ChatMessagesProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  
  const formatTime = (millis: number | undefined) => {
    try {
      if (!millis) return "";
      const date = new Date(millis);
      return date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const copyAssistantText = (message: UIMessage) => {
    const text = (message.parts || [])
      .filter((p: any) => p.type === "text")
      .map((p: any) => (typeof p.text === "string" ? p.text : ""))
      .join("\n\n");
    if (typeof window !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  };

  useEffect(() => {
    const viewport = endRef.current?.closest('[data-slot="scroll-area-viewport"]') as HTMLElement | null;
    if (!viewport) return;

    const handleScroll = () => {
      // Ścisły tryb: auto-scroll tylko gdy rzeczywiście jesteśmy niemal na samym dole
      const threshold = 4; // bardzo mała tolerancja
      const atBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - threshold;
      isAtBottomRef.current = atBottom;
    };
    handleScroll();
    viewport.addEventListener("scroll", handleScroll);

    // Nie używamy IntersectionObserver – powodował „przeskoki” przy streamie

    return () => {
      viewport.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    const hasStreaming = messages.some((m: any) => m?.status === "streaming");
    // W trakcie streamingu zawsze trzymaj na dole
    if (hasStreaming) {
      endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      return;
    }
    // Poza streamingiem przewijaj tylko, gdy użytkownik jest na dole
    if (isAtBottomRef.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  
  

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold mb-2 text-balance">Jak mogę Ci dzisiaj pomóc?</h2>
          <p className="text-muted-foreground text-pretty">Zadaj pytanie lub rozpocznij rozmowę, aby zacząć</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-4 animate-fade-in",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <Avatar className="h-8 w-8 shrink-0 border border-border bg-primary">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}

              <div className={cn("flex max-w-[80%] flex-col gap-2", message.role === "user" ? "items-end" : "items-start")}>                
                <div
                  className={cn(
                    "rounded-lg px-4 py-3 shadow-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground animate-slide-in-right"
                      : "bg-card text-card-foreground border border-border animate-slide-in-left"
                  )}
                >
                  {/* Reasoning stream tylko jako subtelny blok nad odpowiedzią */}
                  {message.role === "assistant" && <ReasoningBlock message={message} />}

                  {message.role === "assistant" &&
                    message.status === "streaming" &&
                    !((message.parts || []).some((p: any) => p.type === "text" && typeof p.text === "string" && p.text.trim().length > 0)) && (
                      <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
                        <Loader size={14} />
                      </div>
                    )}

                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      return message.role === "assistant" ? (
                        <AssistantMarkdown key={index} text={part.text} streaming={message.status === "streaming"} />
                      ) : (
                        <p key={index} className="text-sm leading-relaxed whitespace-pre-wrap">
                          <VisibleText text={part.text} streaming={message.status === "streaming"} />
                        </p>
                      );
                    }
                    const p: any = part as any;
                    const isToolType =
                      typeof p?.type === "string" && (p.type === "tool" || p.type.startsWith("tool-") || p.type === "tool_call" || p.type === "tool-result");
                    if (isToolType) {
                      const toolPart = p;
                      const displayTitle = getToolDisplayName(toolPart.title || toolPart.type || "");
                    }
                  })}
                </div>
                <span className="px-2 text-xs text-muted-foreground">{formatTime(message._creationTime)}</span>
              </div>

              {message.role === "user" && (
                <Avatar className="h-8 w-8 shrink-0 border border-border bg-accent">
                  <AvatarFallback className="bg-accent text-accent-foreground">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>
    </ScrollArea>
  );
}

function VisibleText({ text, streaming }: { text: string; streaming: boolean }) {
  const [visible] = useSmoothText(text, { startStreaming: streaming });
  return <>{visible}</>;
}

function AssistantMarkdown({ text, streaming }: { text: string; streaming: boolean }) {
  const [visible] = useSmoothText(text, { startStreaming: streaming });
  if (!visible) return null;
  return (
    <Response className="text-sm leading-relaxed">
      {String(visible)}
    </Response>
  );
}

function ReasoningBlock({ message }: { message: UIMessage }) {
  const reasoning = (message.parts || [])
    .filter((p) => p.type === "reasoning")
    .map((p: any) => p.text)
    .join("\n");
  const [visible] = useSmoothText(reasoning, { startStreaming: message.status === "streaming" });
  if (!visible) return null;
  return (
    <div className="mb-2">
      <ChainOfThought defaultOpen={message.status === "streaming"}>
        <ChainOfThoughtHeader>
          {message.status === "streaming" ? "Myślenie…" : "Myślenie (chain-of-thought)"}
        </ChainOfThoughtHeader>
        <ChainOfThoughtContent>
          <p className="text-xs whitespace-pre-wrap text-muted-foreground">{visible}</p>
        </ChainOfThoughtContent>
      </ChainOfThought>
    </div>
  );
}


