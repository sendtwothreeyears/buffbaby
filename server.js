require("dotenv").config();
const express = require("express");
const path = require("path");
const twilio = require("twilio");

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  PUBLIC_URL,
  ALLOWED_PHONE_NUMBERS,
  PORT = "3000",
} = process.env;

// Validate required env vars
const required = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "PUBLIC_URL", "ALLOWED_PHONE_NUMBERS"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const allowlist = new Set(ALLOWED_PHONE_NUMBERS.split(",").map((n) => n.trim()));
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const app = express();

app.use(express.urlencoded({ extended: false }));

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "textslash-relay" });
});

app.post("/sms", async (req, res) => {
  const from = req.body.From;
  const body = req.body.Body;
  console.log(`[INBOUND] From: ${from}, Body: ${body}`);

  if (!allowlist.has(from)) {
    console.log(`[BLOCKED] ${from} not in allowlist`);
    return res.sendStatus(200);
  }

  try {
    await client.messages.create({
      to: from,
      from: TWILIO_PHONE_NUMBER,
      body: body,
      mediaUrl: [`${PUBLIC_URL}/test-image.png`],
    });
    console.log(`[OUTBOUND] Echo sent to ${from}`);
  } catch (err) {
    console.error(`[ERROR] Failed to send to ${from}:`, err.message);
  }

  res.sendStatus(200);
});

app.get("/test-image.png", (req, res) => {
  res.sendFile(path.join(__dirname, "assets", "test-image.png"));
});

app.listen(PORT, () => {
  console.log(`Echo server listening on port ${PORT}`);
  console.log(`Webhook URL: ${PUBLIC_URL}/sms`);
  console.log(`Test image:  ${PUBLIC_URL}/test-image.png`);
  console.log(`Allowlist:   ${[...allowlist].join(", ")}`);
});
