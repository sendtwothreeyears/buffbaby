require("dotenv").config();
const { createRelay } = require("./relay-core");

// --- Conditional adapter loading ---
const adapters = [];

const whatsapp = require("./adapters/whatsapp");
if (whatsapp.isConfigured()) {
  adapters.push(whatsapp);
} else {
  console.log("[STARTUP] WhatsApp adapter: not configured (skipping)");
}

const discord = require("./adapters/discord");
if (discord.isConfigured()) {
  adapters.push(discord);
} else {
  console.log("[STARTUP] Discord adapter: not configured (skipping)");
}

const telegram = require("./adapters/telegram");
if (telegram.isConfigured()) {
  adapters.push(telegram);
} else {
  console.log("[STARTUP] Telegram adapter: not configured (skipping)");
}

if (adapters.length === 0) {
  console.error("No adapters configured. Set env vars for at least one channel.");
  process.exit(1);
}

const PORT = process.env.PORT || "3000";
const app = createRelay(adapters);

const server = app.listen(PORT, () => {
  console.log(`[STARTUP] Relay listening on port ${PORT}`);
});

process.on("SIGTERM", async () => {
  console.log("[SHUTDOWN] SIGTERM received, closing server");
  if (app.shutdownAdapters) {
    await app.shutdownAdapters();
  }
  server.close(() => {
    console.log("[SHUTDOWN] Server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 15_000);
});
