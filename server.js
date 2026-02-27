require("dotenv").config();
const { createRelay } = require("./relay-core");
const whatsapp = require("./adapters/whatsapp");

const PORT = process.env.PORT || "3000";
const app = createRelay(whatsapp);

const server = app.listen(PORT, () => {
  console.log(`[STARTUP] Relay listening on port ${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("[SHUTDOWN] SIGTERM received, closing server");
  server.close(() => {
    console.log("[SHUTDOWN] Server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 10_000);
});
