"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  IconChessKnightFilled,
  IconLayoutDashboard,
  IconTrendingDown,
  IconTrendingUp,
  IconLogout,
  IconMinus,
  IconPlus,
  IconShieldLock,
  IconUserEdit,
  IconLoader2,
  IconCheck,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isAdminEmail } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Particles } from "@/components/ui/particles";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface User {
  userId: string;
  email: string;
  username: string;
}

const navItems = [
  { href: "/overview", labelKey: "nav_overview" as const, icon: IconLayoutDashboard },
  { href: "/expenses", labelKey: "nav_expenses" as const, icon: IconMinus },
  { href: "/income", labelKey: "nav_income" as const, icon: IconPlus },
];

function NavContent({ user }: { user: User | null }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const items =
    isAdminEmail(user?.email)
      ? [...navItems, { href: "/admin", labelKey: "nav_admin" as const, icon: IconShieldLock }]
      : navItems;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <IconChessKnightFilled className="size-4" />
        </div>
        <span className="text-base font-semibold tracking-tight">MONEX</span>
      </div>

      <Separator />

      <nav className="flex flex-col gap-1 p-2 flex-1 mt-2">
        {items.map(({ href, labelKey, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>

    </div>
  );
}

function MobileBottomNav({ user }: { user: User | null }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const items = [
    { href: "/overview",  labelKey: "nav_overview" as const,  icon: IconLayoutDashboard },
    { href: "/expenses",  labelKey: "nav_expenses" as const,  icon: IconTrendingDown },
    { href: "/income",    labelKey: "nav_income" as const,    icon: IconTrendingUp },
    ...(isAdminEmail(user?.email)
      ? [{ href: "/admin", labelKey: "nav_admin" as const, icon: IconShieldLock }]
      : []),
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t bg-card/95 backdrop-blur-sm">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map(({ href, labelKey, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center flex-1 gap-1"
            >
              <>
                <Icon className={cn("size-5 transition-colors", active ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-[10px] font-medium transition-colors", active ? "text-primary" : "text-muted-foreground")}>
                  {t(labelKey)}
                </span>
              </>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [particleColor, setParticleColor] = useState("#71717a");

  const [renameOpen, setRenameOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.user) setUser(d.user); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const update = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setParticleColor(isDark ? "#a1a1aa" : "#52525b");
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function openRename() {
    setNewUsername(user?.username ?? "");
    setRenameOpen(true);
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newUsername.trim();
    if (!trimmed) return;
    setRenameLoading(true);
    try {
      const res = await fetch("/api/auth/update-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setUser((prev) => (prev ? { ...prev, username: data.user.username } : prev));
      toast.success(t("name_updated"));
      setRenameOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("name_update_failed"));
    } finally {
      setRenameLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen bg-background">
      <Particles
        className="z-0"
        quantity={120}
        staticity={50}
        ease={50}
        color={particleColor}
      />

      <aside className="relative z-10 hidden md:flex w-60 flex-col border-r bg-card shrink-0">
        <NavContent user={user} />
      </aside>

      <div className="relative z-10 flex flex-1 flex-col min-w-0">
        <header className="flex items-center gap-3 border-b px-4 py-3 bg-card">
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <IconChessKnightFilled className="size-3.5" />
            </div>
            <span className="text-sm font-semibold">MONEX</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Avatar className="size-7 cursor-pointer">
                      <AvatarFallback className="text-xs">
                        {user.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
                    <span className="font-medium text-sm">{user.username}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={openRename}>
                    <IconUserEdit className="size-4" />
                    {t("change_name")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive gap-2 cursor-pointer"
                    onClick={handleLogout}
                  >
                    <IconLogout className="size-4" />
                    {t("sign_out")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 pb-24 md:pb-6">
          {children}
        </main>

        <MobileBottomNav user={user} />
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("change_name")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-username">{t("username")}</Label>
              <Input
                id="new-username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                maxLength={30}
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={renameLoading || !newUsername.trim()}>
                {renameLoading && <IconLoader2 className="size-4 animate-spin" />}
                <IconCheck className="size-4" />
                {t("save_changes")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Toaster richColors position="top-right" />
    </div>
  );
}
