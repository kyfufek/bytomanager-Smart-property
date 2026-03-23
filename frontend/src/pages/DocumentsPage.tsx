import { useState, type KeyboardEvent } from "react";
import { Bot, FileText, Send, Upload, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const mockDocs = [
  { id: 1, name: "Najemni smlouva 2025 - Krejci", type: "PDF" },
  { id: 2, name: "Najemni smlouva 2024 - Nova", type: "PDF" },
  { id: 3, name: "Pojistna smlouva - Praha", type: "PDF" },
  { id: 4, name: "Uctenka - Oprava elektroinstalace", type: "PDF" },
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
    text: "Dobrý den, jsem AI pravnik. Mohu vam pomoci s najmy, vyuctovanim sluzeb nebo orientaci v aplikaci.",
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

    const userMessage: ChatMessage = {
      id: Date.now(),
      from: "user",
      text: message,
    };

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
        body: JSON.stringify({
          message,
          history,
        }),
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

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          from: "ai",
          text: answer,
        },
      ]);
    } catch (error) {
      const messageText =
        error instanceof Error && error.message
          ? error.message
          : "AI pravnik je momentalne nedostupny. Zkuste to prosim znovu.";

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          from: "ai",
          text: "Omlouvam se, nepodarilo se zpracovat dotaz. Zkuste to prosim znovu.",
        },
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
      <div>
        <h1 className="text-2xl font-bold">AI Pravnik & Dokumenty</h1>
        <p className="text-muted-foreground">Sprava smluv a AI konzultace k pravnim otazkam</p>
      </div>

      <Card className="card-shadow">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Trezor dokumentu</CardTitle>
          <Button variant="cta" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Nahrat dokument
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {mockDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent transition-colors cursor-pointer"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{doc.type}</p>
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
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.from === "ai" ? "" : "justify-end"}`}>
                  {msg.from === "ai" ? (
                    <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  ) : null}

                  <div
                    className={`rounded-xl px-4 py-3 max-w-[80%] text-sm whitespace-pre-line ${
                      msg.from === "ai" ? "bg-accent" : "bg-primary text-primary-foreground"
                    }`}
                  >
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
                <Button variant="cta" size="sm" onClick={() => void handleSendMessage()} disabled={isSending}>
                  {isSending ? "Zpracovavam..." : "Vygenerovat odpoved"}
                </Button>
              </div>
            </div>
          </ScrollArea>

          <div className="border-t p-3 flex gap-2">
            <Input
              placeholder="Zeptejte se AI na vase smlouvy nebo zakony..."
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
