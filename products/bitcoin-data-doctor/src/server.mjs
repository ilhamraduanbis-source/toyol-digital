import { Hono } from "hono";
import { stacksPaymentMiddleware } from "@aibtc/x402-stacks-agents/hono";

export const PRICE = 10;
export const MODEL = "@cf/qwen/qwen2.5-coder-32b-instruct";
const SYSTEM = "You are Toyol Data Doctor, a technical assistant for data validation, CSV/JSON schemas, and software debugging. Explain the likely cause, give a minimal safe fix and a reproducible check. Distinguish verified facts from hypotheses. Never invent test results. Do not request private keys, passwords, or financial transactions. Keep the response concise.";

export function validateQuestion(q) {
  if (typeof q !== "string" || !q.trim() || q.length > 2000) return null;
  return q.trim();
}

export async function answer(ai, question) {
  const q = validateQuestion(question);
  if (!q) throw new Error("INVALID_QUESTION");
  const result = await ai.run(MODEL, {
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: q }],
    max_tokens: 384
  });
  if (typeof result?.response !== "string" || !result.response.trim()) throw new Error("INVALID_MODEL_RESPONSE");
  return result.response;
}

export function createApp(env) {
  const app = new Hono();
  const network = env.STACKS_NETWORK;
  const address = env.PAY_TO;
  // Reject missing or mismatched configuration before accepting money.
  if (!["testnet", "mainnet"].includes(network) ||
      typeof address !== "string" ||
      !/^[A-Z0-9]{38,42}$/.test(address) ||
      !(network === "mainnet" ? address.startsWith("SP") : address.startsWith("ST"))) {
    app.all("*", c => c.json({ error: "PAYMENT_CONFIG_REQUIRED" }, 503));
    return app;
  }
  app.get("/", c => c.json({ service: "Toyol Data Doctor", version: "1.0.0", priceSats: PRICE, token: "sBTC", network, route: "/ask?question=...", model: MODEL, maxQuestionChars: 2000 }));
  app.get("/health", c => c.json({ ok: true }));
  // Validate before the payment gate; never charge invalid input.
  app.use("/ask", async (c, next) => {
    if (!validateQuestion(c.req.query("question"))) return c.json({ error: "QUESTION_REQUIRED_MAX_2000_CHARS" }, 400);
    await next();
  });
  // Official Stacks library verifies and settles signed x402 payments.
  // No spending endpoints, wallet secret, or client-supplied settlement verdicts.
  app.use(stacksPaymentMiddleware({
    "GET /ask": { price: PRICE, description: "Toyol Data Doctor technical answer" }
  }, { network, recipient: address, token: "sBTC", settle: "before-run" }));
  app.get("/ask", async c => {
    // Fail closed if the middleware has not established a successful settlement.
    if (!c.get("x402Stacks")?.receipt) return c.json({ error: "SETTLEMENT_REQUIRED" }, 402);
    try { return c.json({ answer: await answer(env.AI, c.req.query("question")), model: MODEL }); }
    catch { return c.json({ error: "MODEL_UNAVAILABLE_AFTER_SETTLEMENT", note: "Contact the operator with the payment receipt; automatic refunds are not implemented." }, 503); }
  });
  return app;
}
export default { fetch(request, env, ctx) { return createApp(env).fetch(request, env, ctx); } };
