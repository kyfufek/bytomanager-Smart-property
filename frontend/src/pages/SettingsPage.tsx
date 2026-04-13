import { useEffect, useMemo, useState } from "react";
import { BellRing, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { DataState } from "@/components/product/DataState";
import { PageHeader } from "@/components/product/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";

type ProfileResponse = {
  id: string;
  full_name: string | null;
  phone: string | null;
  phone_supported?: boolean;
  email: string | null;
};

export default function SettingsPage() {
  const { user, setLocalProfileName } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isPhoneSupported, setIsPhoneSupported] = useState(true);
  const [initialProfileSnapshot, setInitialProfileSnapshot] = useState({ fullName: "", phone: "" });
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);

  const initialEmail = useMemo(() => user?.email ?? "", [user?.email]);

  async function syncAuthDisplayName(nextName: string) {
    if (!user) return;
    const normalized = nextName.trim();
    const current = String(user.user_metadata?.full_name ?? "").trim();
    if (normalized !== current) {
      setLocalProfileName(normalized);
    }
    if (normalized === current) return;

    try {
      await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          full_name: normalized || null,
        },
      });
    } catch {
      // Header fallback remains email when metadata update fails.
    }
  }

  async function loadProfile(signal?: AbortSignal) {
    try {
      setIsLoadingProfile(true);
      setLoadError("");

      const response = await apiFetch("/api/profile", { signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as ProfileResponse;
      const resolvedName = data.full_name ?? "";
      const resolvedPhone = data.phone ?? "";
      const resolvedEmail = data.email ?? initialEmail;
      const phoneSupported = data.phone_supported !== false;

      setFullName(resolvedName);
      setPhone(resolvedPhone);
      setEmail(resolvedEmail);
      setIsPhoneSupported(phoneSupported);
      setInitialProfileSnapshot({ fullName: resolvedName, phone: resolvedPhone });
      await syncAuthDisplayName(resolvedName);
    } catch {
      if (signal?.aborted) return;
      setEmail(initialEmail);
      setLoadError("Profil se nepodarilo nacist. Zkuste to prosim znovu.");
    } finally {
      if (!signal?.aborted) {
        setIsLoadingProfile(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    setEmail(initialEmail);
    loadProfile(controller.signal);
    return () => controller.abort();
  }, [initialEmail]);

  async function handleSaveProfile() {
    if (isSavingProfile) return;

    try {
      setIsSavingProfile(true);
      const response = await apiFetch("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          full_name: fullName,
          phone: isPhoneSupported ? phone : null,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as ProfileResponse;
      const resolvedName = data.full_name ?? "";
      const phoneSupported = data.phone_supported !== false;
      setFullName(resolvedName);
      setPhone(phoneSupported ? (data.phone ?? "") : "");
      setEmail(data.email ?? initialEmail);
      setIsPhoneSupported(phoneSupported);
      setInitialProfileSnapshot({ fullName: resolvedName, phone: phoneSupported ? (data.phone ?? "") : "" });
      setLastSavedAt(new Date());
      await syncAuthDisplayName(resolvedName);

      toast({
        title: "Profil ulozen",
        description: phoneSupported
          ? "Jmeno a telefon byly uspesne aktualizovany."
          : "Jmeno bylo uspesne aktualizovano.",
      });
    } catch {
      toast({
        title: "Ulozeni selhalo",
        description: "Profil se nepodarilo ulozit. Zkuste to znovu.",
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  function handleSaveNotifications() {
    toast({
      title: "Notifikace ulozeny",
      description: "Preference notifikaci byly uspesne aktualizovany.",
    });
  }

  function handleRevokeSessions() {
    toast({
      title: "Relace odhlaseny",
      description: "Vsechny aktivni relace byly ukonceny (demo akce).",
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Nastaveni"
        description="Sprava uctu, notifikaci a bezpecnostnich voleb."
        actions={<Badge className="bg-primary/10 text-primary border-0">Lokalni nastaveni</Badge>}
      />

      {loadError && !isLoadingProfile ? (
        <DataState
          variant="error"
          title="Profil se nepodarilo nacist"
          description={loadError}
          actionLabel="Zkusit znovu"
          onAction={() => loadProfile()}
        />
      ) : null}

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span>Profil</span>
            {lastSavedAt ? (
              <Badge variant="secondary" className="bg-success/10 text-success border-0">
                Ulozeno v {lastSavedAt.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingProfile ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-40" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="settings-name">Jmeno a prijmeni</Label>
                  <Input
                    id="settings-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-email">E-mail</Label>
                  <Input id="settings-email" value={email} readOnly className="bg-muted/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-phone">Telefon</Label>
                <Input
                  id="settings-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!isPhoneSupported}
                />
                {!isPhoneSupported ? (
                  <p className="text-xs text-muted-foreground">
                    Telefon zatim nelze ulozit, protoze databaze neobsahuje sloupec <code>phone</code> v tabulce <code>profiles</code>.
                  </p>
                ) : null}
              </div>
              <Button
                variant="cta"
                onClick={handleSaveProfile}
                disabled={isSavingProfile || (fullName === initialProfileSnapshot.fullName && phone === initialProfileSnapshot.phone)}
              >
                {isSavingProfile
                  ? "Ukladam..."
                  : fullName === initialProfileSnapshot.fullName && phone === initialProfileSnapshot.phone
                    ? "Beze zmen"
                    : "Ulozit zmeny"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" />
            Notifikace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">E-mailove notifikace</p>
              <p className="text-xs text-muted-foreground">Upozorneni o platbach a dulezitych udalostech</p>
            </div>
            <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">AI doporuceni</p>
              <p className="text-xs text-muted-foreground">Navrhy od AI asistenta pro komunikaci a finance</p>
            </div>
            <Switch checked={aiSuggestions} onCheckedChange={setAiSuggestions} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">SMS upozorneni</p>
              <p className="text-xs text-muted-foreground">Kriticke udalosti jako dluh nebo prodleni</p>
            </div>
            <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} />
          </div>
          <Button variant="outline" onClick={handleSaveNotifications}>
            Ulozit preference
          </Button>
        </CardContent>
      </Card>

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Bezpecnost
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-sm font-medium">Posledni prihlaseni</p>
            <p className="text-xs text-muted-foreground mt-1">Dnes, 09:24, Chrome na Windows</p>
          </div>
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-sm font-medium">2FA</p>
            <p className="text-xs text-muted-foreground mt-1">Doporuceno zapnout po napojeni produkcniho auth flow.</p>
          </div>
          <Button variant="outline" onClick={handleRevokeSessions}>
            Odhlasit vsechny relace
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
