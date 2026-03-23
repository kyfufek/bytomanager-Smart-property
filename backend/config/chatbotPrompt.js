const fs = require("fs");
const path = require("path");

const promptPath = path.join(__dirname, "..", "chatbot-instructions.md");

function loadChatbotSystemPrompt() {
  try {
    return fs.readFileSync(promptPath, "utf8").trim();
  } catch (error) {
    console.error("[chatbot] Failed to load system prompt file:", promptPath, error);
    throw new Error("Failed to load chatbot system prompt.");
  }
}

const chatbotSystemPrompt = loadChatbotSystemPrompt();

module.exports = { chatbotSystemPrompt, promptPath };
