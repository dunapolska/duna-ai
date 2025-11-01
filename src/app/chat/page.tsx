"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ChatSidebar from "@/components/chat/chat-sidebar";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { SignedIn, SignedOut } from "@clerk/nextjs";

function SignedOutRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/sign-in'); }, [router]);
  return null;
}

export default function ChatPage() {
  const router = useRouter();
  const getOrCreate = useMutation(api.chat.getLatestEmptyOrCreateThread);
  const hasCreatedRef = useRef(false);

  useEffect(() => {
    if (hasCreatedRef.current) return;
    hasCreatedRef.current = true;
    (async () => {
      const id = await getOrCreate({});
      router.replace(`/chat/${id}`);
    })();
  }, [getOrCreate, router]);

  return (
    <>
    <SignedIn>
    <SidebarProvider className="h-[calc(100vh-4rem)] min-h-0" style={{ height: "calc(100vh - 4rem)", minHeight: 0 }}>
      <div className="flex h-full max-h-full w-full">
        <Sidebar className="top-16">
          <ChatSidebar />
        </Sidebar>
        <SidebarInset className="min-h-0">
          <div className="flex flex-col flex-1 min-w-0 min-h-0">
            <div className="flex h-[61px] items-center gap-2 border-b px-2">
              <SidebarTrigger />
              <div className="text-sm text-muted-foreground">Czat</div>
            </div>
            <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
              Przekierowywanie do nowej rozmowy…
            </div>
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
