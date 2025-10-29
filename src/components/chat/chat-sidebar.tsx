"use client";

import type React from "react";
import { useMemo, useState, useEffect } from "react";
import { Plus, MessageSquare, Trash2, MoreVertical, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { usePathname, useRouter } from "next/navigation";
import {
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarSeparator,
} from "@/components/ui/sidebar";

type ChatSidebarProps = {
  activeThreadId?: string | null;
  onSelectThread?: (threadId: string) => void;
};

export default function ChatSidebar({ activeThreadId, onSelectThread }: ChatSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [localActiveId, setLocalActiveId] = useState<string | null>(null);
  const selectedId = activeThreadId ?? localActiveId;

  useEffect(() => {
    // Wyciągnij threadId z /chat/[id]
    const match = pathname?.match(/^\/chat\/(.+)$/);
    const idFromUrl = match ? match[1] : null;
    if (idFromUrl && idFromUrl !== localActiveId) {
      setLocalActiveId(idFromUrl);
    }
  }, [pathname]);

  const threads = useQuery(api.chat.listUserThreads, { numItems: 50 }) ?? [];
  const createFresh = useMutation(api.chat.createFreshThreadForUser);
  const rename = useMutation(api.chat.renameThread);
  const archive = useMutation(api.chat.archiveThread);

  const handleSelect = (id: string) => {
    // Preferuj URL, zachowując onSelect dla trybu kontrolowanego
    if (onSelectThread) onSelectThread(id);
    router.push(`/chat/${id}`);
    setLocalActiveId(id);
  };

  const handleCreate = async () => {
    const id = await createFresh({});
    if (id) handleSelect(id);
  };

  const activeThreads = useMemo(() => threads.filter((t: any) => t.status !== "archived"), [threads]);

  const grouped = useMemo(() => {
    const today: any[] = [];
    const yesterday: any[] = [];
    const previous7Days: any[] = [];
    const previous30Days: any[] = [];
    const older: any[] = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const start7DaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;
    const start30DaysAgo = startOfToday - 30 * 24 * 60 * 60 * 1000;

    for (const t of activeThreads) {
      if (t._creationTime >= startOfToday) today.push(t);
      else if (t._creationTime >= startOfYesterday) yesterday.push(t);
      else if (t._creationTime >= start7DaysAgo) previous7Days.push(t);
      else if (t._creationTime >= start30DaysAgo) previous30Days.push(t);
      else older.push(t);
    }
    return { today, yesterday, previous7Days, previous30Days, older };
  }, [activeThreads]);

  const SectionHeader = ({ children }: { children: React.ReactNode }) => (
    <SidebarGroupLabel className="px-3 py-2 text-xs font-medium text-muted-foreground">
      {children}
    </SidebarGroupLabel>
  );

  const ThreadItem = ({ thread }: { thread: any }) => {
    const title = thread.title ?? "Nowy wątek";
    const isActive = selectedId === thread._id;

    return ( 
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={isActive}
          onClick={() => handleSelect(thread._id)}
          className={cn(
            "group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
            isActive
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span className="truncate">{title}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <span
                role="button"
                tabIndex={0}
                aria-label="actions"
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "h-6 w-6 shrink-0 rounded-md grid place-items-center transition-opacity",
                  isActive
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                )}
              >
                <MoreVertical className="h-4 w-4" />
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  const newTitle = prompt("Nowy tytuł", title) ?? title;
                  if (newTitle && newTitle !== title) {
                    rename({ threadId: thread._id, title: newTitle }).catch(() => {});
                  }
                }}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Zmień nazwę
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async (e) => {
                  e.stopPropagation();
                  if (confirm("Usunąć rozmowę?")) {
                    try {
                      await archive({ threadId: thread._id });
                      if (selectedId === thread._id) {
                        const list = activeThreads.filter((t: any) => t._id !== thread._id);
                        const fallback = list[0]?._id;
                        if (fallback) handleSelect(fallback);
                        else {
                          const freshId = await createFresh({});
                          handleSelect(freshId);
                        }
                      }
                    } catch (_) {}
                  }
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Usuń
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <>
      <SidebarHeader className="h-[61px] flex flex-row items-center gap-2 border-b border-sidebar-border p-0 px-2">
        <div className="flex items-center gap-2 w-full">
          <Button className="w-full justify-start gap-2 h-10" size="default" onClick={handleCreate}>
            <Plus className="h-4 w-4" />
            Nowa rozmowa
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="no-scrollbar overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {threads.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-sidebar-foreground/50">
                  Brak rozmów. Zacznij nową, aby pojawiła się na liście.
                </div>
              )}

              {grouped.today.length > 0 && (
                <>
                  <SectionHeader>Dzisiaj</SectionHeader>
                  {grouped.today.map((t: any) => (
                    <ThreadItem key={t._id} thread={t} />
                  ))}
                  <SidebarSeparator />
                </>
              )}

              {grouped.yesterday.length > 0 && (
                <>
                  <SectionHeader>Wczoraj</SectionHeader>
                  {grouped.yesterday.map((t: any) => (
                    <ThreadItem key={t._id} thread={t} />
                  ))}
                  <SidebarSeparator />
                </>
              )}

              {grouped.previous7Days.length > 0 && (
                <>
                  <SectionHeader>Ostatnie 7 dni</SectionHeader>
                  {grouped.previous7Days.map((t: any) => (
                    <ThreadItem key={t._id} thread={t} />
                  ))}
                  <SidebarSeparator />
                </>
              )}

              {grouped.previous30Days.length > 0 && (
                <>
                  <SectionHeader>Ostatnie 30 dni</SectionHeader>
                  {grouped.previous30Days.map((t: any) => (
                    <ThreadItem key={t._id} thread={t} />
                  ))}
                  <SidebarSeparator />
                </>
              )}

              {grouped.older.length > 0 && (
                <>
                  <SectionHeader>Starsze</SectionHeader>
                  {grouped.older.map((t: any) => (
                    <ThreadItem key={t._id} thread={t} />
                  ))}
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
}


