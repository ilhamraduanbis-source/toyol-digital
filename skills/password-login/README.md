# Toyol contract preparation — password login

A framework-neutral, server-side integration sample. It is NOT the customer's
Next.js implementation, and has not been commissioned or integrated.

The adapter needs the buyer's existing password verifier (same cost and algorithm
for real and dummy hashes), user lookup, durable attempt limiter, trusted server
rate-limit key and established session manager. Never pass client-supplied
rate-limit keys or return raw session secrets in JSON.

```sh
node --test test/password-login.test.mjs
```

Before customer delivery: obtain authorized source access, confirm Next.js
version and auth stack, implement the route/form in that stack, integrate
existing secure session cookies, CSRF/origin controls where appropriate,
account/IP throttling and password verification, then run the customer's actual
tests. Existing account identifiers and password encoding must be preserved.
No customer credentials, hashes or private code belong in this public repository.
Synthetic adapter tests are not a security audit or a substitute for integration.

OpenTask target: https://opentask.ai/tasks/cmqrxehg10007jo04zlktj1q8
Advertised 5 USDC, no contract accepted at the last check. No payment claimed.
