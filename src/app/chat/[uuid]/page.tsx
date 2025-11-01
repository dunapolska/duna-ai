"use client";

import { useRouter, useParams } from "next/navigation";
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import ChatSidebar from "@/components/chat/chat-sidebar";
import ChatThreadView from "@/components/chat/chat-thread-view";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { useEffect } from "react";

function SignedOutRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/sign-in'); }, [router]);
  return null;
}

export default function ChatThreadRoutePage() {
  const params = useParams<{ uuid: string }>();
  const threadId = params?.uuid ?? null;

  return (
    <>
    <SignedIn>
    <SidebarProvider className="h-[calc(100vh-4rem)] min-h-0" style={{ height: "calc(100vh - 4rem)", minHeight: 0 }}>
      <div className="flex h-full max-h-full w-full">
        <Sidebar className="top-16">
          <ChatSidebar activeThreadId={threadId} onSelectThread={(id) => { /* na tej stronie linkujemy URL, więc onSelect nieużywany */ }} />
        </Sidebar>
        <SidebarInset className="min-h-0">
          <div className="flex flex-col flex-1 min-w-0 min-h-0">
            <div className="flex h-[61px] items-center gap-2 border-b px-2 bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40">
              <SidebarTrigger />
              <div className="text-sm text-muted-foreground">Jak mogę Ci dzisiaj pomóc?</div>
            </div>
            {threadId ? (
              <ChatThreadView threadId={threadId} />
            ) : null}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
    </SignedIn>
    <SignedOut>
      <SignedOutRedirect />
    </SignedOut>
    </>
  );
}


