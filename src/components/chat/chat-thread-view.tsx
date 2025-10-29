"use client";

import { useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUIMessages } from "@convex-dev/agent/react";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "../ai-elements/chat-input";

export default function ChatThreadView({ threadId }: { threadId: string }) {
  const streamReply = useMutation(api.chat.initiateAsyncStreaming);
  // Abort jest dostępny w API, ale UI wejścia nie obsługuje przycisku anulowania.

  const { results: messages = [] } = useUIMessages(
    api.chat.listThreadMessagesStreaming,
    { threadId },
    { initialNumItems: 200, stream: true }
  );

  const isStreaming = useMemo(
    () => messages.some((m) => m.status === "streaming"),
    [messages]
  );

  const handleSend = async ({ text }: { text: string }) => {
    await streamReply({ threadId, prompt: text });
  };

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0">
      <div className="flex-1 min-h-0 bg-gradient-to-b from-background to-muted/30">
        <ChatMessages messages={messages} />
      </div>

      <div className="shrink-0 border-t bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40">
        <div className="mx-auto max-w-4xl px-4 py-3">
          <ChatInput onSendMessage={handleSend} isLoading={isStreaming} />
        </div>
      </div>
    </div>
  );
}


