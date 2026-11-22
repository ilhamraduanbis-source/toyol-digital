// Original zero-spend evidence gate. Pure, independently testable, no network.
export function assess(task, evidence="none") {
  if (typeof task !== "string" || !task.trim()) throw new Error("A task description is required")
  if (task.length > 240) throw new Error("Limit task description to 240 characters")
  if (!["none","local_test","external_confirmation"].includes(evidence)) throw new Error("Unknown evidence")
  const raw = task.trim()
  const sensitive = /\b(password|private key|seed phrase|api key|recovery phrase)\b/i.test(raw)
  if (sensitive) return {status:"STOP",reason:"Sensitive credentials must not be entered or processed.",next:"Remove secrets, then re-assess."}
  const payment = /\b(paid|payment|deposit|purchase|credit card|billing|transfer)\b/i.test(raw)
  if (payment && evidence !== "external_confirmation") return {status:"HOLD",reason:"Payment-related action needs independent owner confirmation.",next:"Verify recipient, fees, free quota and explicit consent."}
  if (evidence === "none") return {status:"NEEDS_PROOF",reason:"No evidence supplied; no pass or earning claim.",next:"Run a local test or obtain genuine external confirmation."}
  if (evidence === "local_test") return {status:"TESTED_LOCALLY",reason:"Local tests support code behavior, not enrollment or payment.",next:"Confirm official platform acceptance."}
  return {status:"HUMAN_REVIEW",reason:"External confirmation self-reported; app cannot independently verify.",next:"Review original issuer record before claiming results."}
}
export function hudText(title,result) {
  const clean=String(title).replace(/[\r\n\t]/g," ").slice(0,46)
  return [clean,"STATUS: "+result.status,result.reason,result.next,"Tap next, scroll up prev"].join("\n").slice(0,400)
}
