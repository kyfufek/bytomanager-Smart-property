import { useState, type KeyboardEvent } from "react";
import { Bot, FileText, Send, Upload, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/product/PageHeader";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const mockDocs = [
  { id: 1, name: "Najemni smlouva 2025 - Krejci", type: "PDF", context: "Najemnik Jan Krejci", action: "Polozit dotaz ke smlouve" },
  { id: 2, name: "Najemni smlouva 2024 - Nova", type: "PDF", context: "Najemnice Petra Nova", action: "Zkontrolovat dodatky" },
  { id: 3, name: "Pojistna smlouva - Praha", type: "PDF", context: "Nemovitost Praha 2", action: "Shrnout kryti" },
  { id: 4, name: "Uctenka - Oprava elektroinstalace", type: "PDF", context: "Servisni zasah", action: "Pouzit jako podklad" },
];

type ChatRole = "user" | "ai";

type ChatMessage = {
  id: number;
  from: ChatRole;
  text: string;
};

type ChatApiResponse = {
  answer?: string;
  error?: string;
};

const initialChat: ChatMessage[] = [
  {
    id: 1,
    from: "ai",
    text: "Dobry den, jsem AI pravnik. Pomohu s najemnimu vztahem, vyuctovanim sluzeb nebo rychlym vysvetlenim dokumentu z trezoru.",
  },
];

export default function DocumentsPage() {
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(initialChat);
  const [isSending, setIsSending] = useState(false);

  async function handleSendMessage() {
    const message = chatInput.trim();
    if (!message || isSending) {
      if (!message) {
        toast({
          title: "Prazdna zprava",
          description: "Napis dotaz pro AI pravnika.",
          variant: "destructive",
        });
      }
      return;
    }

    const userMessage: ChatMessage = { id: Date.now(), from: "user", text: message };
    const history = messages.map((item) => ({
      role: item.from === "ai" ? "assistant" : "user",
      content: item.text,
    }));

    setMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setIsSending(true);

    try {
      const response = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message, history }),
      });

      let payload: ChatApiResponse = {};
      try {
        payload = (await response.json()) as ChatApiResponse;
      } catch {
        payload = {};
      }

      if (!response.ok) {
        throw new Error(payload.error || "Nepodarilo se ziskat odpoved od AI pravnika.");
      }

      const answer = typeof payload.answer === "string" ? payload.answer.trim() : "";
      if (!answer) {
        throw new Error("AI pravnik vratil prazdnou odpoved.");
      }

      setMessages((prev) => [...prev, { id: Date.now() + 1, from: "ai", text: answer }]);
    } catch (error) {
      const messageText = error instanceof Error && error.message
        ? error.message
        : "AI pravnik je momentalne nedostupny. Zkuste to prosim znovu.";

      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 2, from: "ai", text: "Omlouvam se, nepodarilo se zpracovat dotaz. Zkuste to prosim znovu." },
      ]);

      toast({
        title: "Nepodarilo se odeslat dotaz",
        description: messageText,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="AI Pravnik & Dokumenty" description="Dokumentovy trezor s rychlym pravnim kontextem a chatem pro konkretni dotazy." />

      <Card className="card-shadow">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Trezor dokumentu</CardTitle>
          <Button variant="cta" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Nahrat dokument
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Co uz funguje</p>
              <p className="mt-1 text-sm font-medium">Rychle dotazy nad pravnim kontextem aplikace</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Dokumentovy trezor</p>
              <p className="mt-1 text-sm font-medium">Prehled podkladu s navrhem dalsi akce</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Dalsi krok</p>
              <p className="mt-1 text-sm font-medium">Vyber dokument nebo polozte konkretni dotaz</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {mockDocs.map((doc) => (
              <div key={doc.id} className="rounded-lg border p-3 transition-colors hover:bg-accent">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.type}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{doc.context}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setChatInput(`Vysvetli mi dokument: ${doc.name}`)}>
                    Otevrit v chatu
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => toast({ title: "Akce pripravljena", description: doc.action })}>
                    {doc.action}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="card-shadow">
        <CardHeader className="border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            AI Pravni konzultant
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex flex-col h-96">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                Nejlepe funguje pro vysvetleni ustanoveni ze smlouvy, navrh odpovedi najemnikovi, kontrolu vyuctovani sluzeb nebo orientaci v procesech aplikace.
              </div>

              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.from === "ai" ? "" : "justify-end"}`}>
                  {msg.from === "ai" ? (
                    <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  ) : null}

                  <div className={`max-w-[80%] whitespace-pre-line rounded-xl px-4 py-3 text-sm ${msg.from === "ai" ? "bg-accent" : "bg-primary text-primary-foreground"}`}>
                    {msg.text}
                  </div>

                  {msg.from === "user" ? (
                    <div className="h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ) : null}
                </div>
              ))}

              <div className="pl-11">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setChatInput("Zkontroluj, jestli je tato vypoved formalne v poradku.")}>
                    Kontrola vypovedi
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setChatInput("Shrn mi, co ma obsahovat formalni vyuctovani sluzeb.")}>
                    Vyuctovani sluzeb
                  </Button>
                  <Button variant="cta" size="sm" onClick={() => void handleSendMessage()} disabled={isSending}>
                    {isSending ? "Zpracovavam..." : "Vygenerovat odpoved"}
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="border-t p-3 flex gap-2">
            <Input
              placeholder="Zeptejte se AI na dokument, vypoved, dodatek nebo pravni postup..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              className="flex-1"
              disabled={isSending}
            />
            <Button variant="cta" size="icon" onClick={() => void handleSendMessage()} disabled={isSending}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
