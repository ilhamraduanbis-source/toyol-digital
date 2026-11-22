// Independent safety policy. Test without Firebase credentials or network use.
const SENSITIVE=/\b(password|seed phrase|private key|api key|otp|bank account)\b/i
export function hasFirebaseConfig(config) {
 return ["apiKey","projectId","appId"].every(k=>typeof config[k]==="string"&&config[k].trim().length>3)
}
export function cloudAllowed(flags) {
 return flags.userConsent===true && flags.quotaVerified===true &&
        flags.billingDisabledConfirmed===true && flags.cloudFeatureEnabled===true
}
export function safePrompt(prompt) {
 if(typeof prompt!=="string"||!prompt.trim()) throw Error("Prompt required")
 if(prompt.length>500) throw Error("Prompt too long")
 if(SENSITIVE.test(prompt)) throw Error("Potentially sensitive content blocked")
 return prompt.trim()
}
export function chooseMode({userConsent,quotaVerified,billingDisabledConfirmed,cloudFeatureEnabled}) {
 return cloudAllowed({userConsent,quotaVerified,billingDisabledConfirmed,cloudFeatureEnabled})
  ? "PREFER_ON_DEVICE" : "ONLY_ON_DEVICE"
}
