const express = require("express");
const { requireAuth } = require("../middleware/requireAuth");
const { llmService, LLMServiceError } = require("../services/llm");
const { chatbotSystemPrompt } = require("../config/chatbotPrompt");

const router = express.Router();

router.use(requireAuth);

const ALLOWED_HISTORY_ROLES = new Set(["user", "assistant"]);
const MAX_HISTORY_ITEMS = 50;

function validateHistory(history) {
  if (!Array.isArray(history)) {
    return 'Pole "history" musi byt pole.';
  }

  if (history.length > MAX_HISTORY_ITEMS) {
    return `Pole "history" muze obsahovat maximalne ${MAX_HISTORY_ITEMS} zprav.`;
  }

  for (let i = 0; i < history.length; i += 1) {
    const item = history[i];
    if (!item || typeof item !== "object") {
      return `Polozka history[${i}] musi byt objekt.`;
    }

    const role = typeof item.role === "string" ? item.role.trim() : "";
    const content = typeof item.content === "string" ? item.content.trim() : "";

    if (!ALLOWED_HISTORY_ROLES.has(role)) {
      return `Polozka history[${i}] ma nepodporovanou roli.`;
    }

    if (!content) {
      return `Polozka history[${i}] musi obsahovat neprazdny text.`;
    }
  }

  return null;
}

router.post("/chat", async (req, res) => {
  try {
    const body = req.body || {};
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const history = typeof body.history === "undefined" ? [] : body.history;

    if (!message) {
      return res.status(400).json({
        error: 'Pole "message" je povinne a nesmi byt prazdne.',
      });
    }

    const historyError = validateHistory(history);
    if (historyError) {
      return res.status(400).json({ error: historyError });
    }

    const preparedMessages = [
      { role: "system", content: chatbotSystemPrompt },
      ...history.map((item) => ({
        role: item.role.trim(),
        content: item.content.trim(),
      })),
      { role: "user", content: message },
    ];

    const answer = await llmService.generateText({
      messages: preparedMessages,
    });

    return res.status(200).json({
      answer,
      meta: {
        provider: llmService.provider,
        model: llmService.model,
      },
    });
  } catch (error) {
    if (error instanceof LLMServiceError) {
      const status = Number.isInteger(error.status) ? error.status : 502;
      return res.status(status).json({
        error: "Chatbot je docasne nedostupny. Zkuste to prosim znovu.",
        code: error.code,
      });
    }

    console.error("[chat] Unexpected error:", error);
    return res.status(500).json({
      error: "Doslo k neocekavane chybe pri zpracovani chatu.",
    });
  }
});

module.exports = router;
