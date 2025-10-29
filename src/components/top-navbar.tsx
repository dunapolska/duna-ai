"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Database, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/nextjs";

export default function TopNavbar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/chat", label: "Chat", icon: MessageSquare },
    { href: "/knowledge", label: "Zarządzanie Wiedzą", icon: Database },
    { href: "/settings", label: "Ustawienia", icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-card shadow-sm relative">
      <div className="flex h-16 items-center px-6 gap-6">
        <Link href="/" className="flex items-center gap-3 font-semibold">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <MessageSquare className="h-5 w-5" />
          </div>
          <span className="text-xl font-semibold text-foreground">Duna AI</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-2 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="default"
                  className="gap-2 font-medium"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* User Menu */}
        <UserButton 
          afterSignOutUrl="/sign-in"
          appearance={{
            elements: {
              avatarBox: "h-8 w-8"
            }
          }}
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-px bg-border" />
    </header>
  );
}


