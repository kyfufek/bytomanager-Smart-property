import { useState } from "react";
import { FileText, Upload, Send, Bot, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

// TODO: napojit na API
const mockDocs = [
  { id: 1, name: "Nájemní smlouva 2025 – Krejčí", type: "PDF" },
  { id: 2, name: "Nájemní smlouva 2024 – Nová", type: "PDF" },
  { id: 3, name: "Pojistná smlouva – Praha", type: "PDF" },
  { id: 4, name: "Účtenka – Oprava elektroinstalace", type: "PDF" },
];

const mockChat = [
  {
    from: "user",
    text: "Můžu vyhodit nájemníka v Bytě A za to, že má psa?",
  },
  {
    from: "ai",
    text: '📄 Podle čl. 5 Nájemní smlouvy 2025 (Krejčí): "Nájemník nesmí chovat domácí zvířata bez písemného souhlasu pronajímatele."\n\nPokud nájemník chová psa bez vašeho souhlasu, máte právo na výpověď dle § 2291 občanského zákoníku s výpovědní lhůtou 3 měsíce.\n\n⚖️ Doporučení: Nejprve písemně upozorněte nájemníka.',
  },
];

export default function DocumentsPage() {
  const [chatInput, setChatInput] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Právník & Dokumenty</h1>
        <p className="text-muted-foreground">
          Správa smluv a AI konzultace k právním otázkám
        </p>
      </div>

      {/* Document vault */}
      <Card className="card-shadow">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Trezor dokumentů</CardTitle>
          <Button variant="cta" size="sm">
            <Upload className="mr-2 h-4 w-4" /> Nahrát dokument
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

      {/* RAG Chatbot */}
      <Card className="card-shadow">
        <CardHeader className="border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" /> AI Právní konzultant
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex flex-col h-96">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {mockChat.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.from === "ai" ? "" : "justify-end"}`}
                >
                  {msg.from === "ai" && (
                    <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`rounded-xl px-4 py-3 max-w-[80%] text-sm whitespace-pre-line ${
                      msg.from === "ai"
                        ? "bg-accent"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.from === "user" && (
                    <div className="h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {/* Action */}
              <div className="pl-11">
                <Button variant="cta" size="sm">
                  Vygenerovat výpověď
                </Button>
              </div>
            </div>
          </ScrollArea>
          <div className="border-t p-3 flex gap-2">
            <Input
              placeholder="Zeptejte se AI na vaše smlouvy nebo zákony..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1"
            />
            {/* TODO: napojit na API (LangChain/Pinecone) */}
            <Button variant="cta" size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
