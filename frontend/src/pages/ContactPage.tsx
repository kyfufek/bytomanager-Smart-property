import { useEffect, useState } from "react";
import { LifeBuoy, MailCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/product/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactPage() {
  const { user } = useAuth();
  const initialName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const initialEmail = user?.email ?? "";

  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      setSubmitState("error");
      toast({
        title: "Formular neni kompletni",
        description: "Vyplnte prosim jmeno, e-mail i zpravu.",
        variant: "destructive",
      });
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setSubmitState("error");
      toast({
        title: "Neplatny e-mail",
        description: "Zadejte prosim e-mail ve spravnem formatu.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitState("idle");

      const response = await apiFetch("/api/contact", {
        method: "POST",
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          message: trimmedMessage,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setMessage("");
      setSubmitState("success");
      toast({
        title: "Zprava odeslana",
        description: "Dekujeme, ozveme se vam co nejdrive.",
      });
    } catch {
      setSubmitState("error");
      toast({
        title: "Odeslani selhalo",
        description: "Kontaktni formular se nepodarilo odeslat. Zkuste to prosim znovu pozdeji.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Kontakt"
        description="Poslete nam zpravu k podpore aplikace, uctu nebo navrhum na zlepseni."
        actions={<Badge className="border-0 bg-primary/10 text-primary">Podpora Bytomanageru</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="text-xl">Kontaktni formular</CardTitle>
            <CardDescription>
              Zpravu preposleme primo do n8n workflow, ktery obsluhuje dalsi komunikaci.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Jmeno</Label>
                  <Input
                    id="contact-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Jan Novak"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">E-mail</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="jan@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-message">Zprava</Label>
                <Textarea
                  id="contact-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Popiste, s cim potrebujete pomoct."
                  className="min-h-[180px] resize-y"
                />
                <p className="text-xs text-muted-foreground">
                  Odpovidame typicky behem jednoho pracovniho dne.
                </p>
              </div>

              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  {submitState === "success"
                    ? "Posledni zprava byla uspesne odeslana."
                    : submitState === "error"
                      ? "Posledni pokus selhal. Muzete jej hned zopakovat."
                      : "Po odeslani uvidite potvrzeni nebo chybu primo zde i v toastu."}
                </div>
                <Button type="submit" variant="cta" disabled={isSubmitting}>
                  {isSubmitting ? "Odesilam..." : "Odeslat zpravu"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LifeBuoy className="h-4 w-4 text-primary" />
                Co sem patri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Technicke potize s aplikaci, nejasnosti v datech nebo navrhy na funkcni rozsireni.</p>
              <p>Pokud hlasite chybu, pridejte co nejpresnejsi popis kroku a ocekavaneho vysledku.</p>
            </CardContent>
          </Card>

          <Card className="card-shadow border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MailCheck className="h-4 w-4 text-primary" />
                Co se stane po odeslani
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-foreground/80">
              <p>Backend zpravu pouze validuje a preposila do `n8n` webhooku bez dalsiho zpracovani.</p>
              <p>Pri nedostupnem webhooku vratime chybu a formular zustane vyplneny pro opakovani.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
