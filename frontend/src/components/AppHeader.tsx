import { Bell, LogOut, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export function AppHeader() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "Uzivatel";

  const initials =
    displayName
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") ?? "U";

  async function handleLogout() {
    await logout();
    navigate("/auth", { replace: true });
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-card px-4">
      <SidebarTrigger className="shrink-0" />

      <div className="relative hidden flex-1 sm:block sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Hledat..." className="pl-9 bg-secondary border-0" />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button className="relative rounded-md p-2 hover:bg-accent transition-colors" type="button">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </button>

        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium md:block">{displayName}</span>
        </div>

        <Button type="button" variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Odhlasit se
        </Button>
      </div>
    </header>
  );
}
