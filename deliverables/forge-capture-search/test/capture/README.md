# Capture and search verification

This contribution uses synthetic data only. It does not send the library, files or credentials to external services.

## Local setup (Node 22+)

On macOS, install the optional Poppler command-line extractor with `brew install poppler`, then check `pdftotext -v`. On Debian/Ubuntu the equivalent package is `poppler-utils`. No Node dependencies are needed.

Run the frozen customer check unchanged:

```sh
node --test .plan/checks/capture-search.test.mjs
REQUIRE_PDF_EXTRACTOR=1 node --test test/capture/capture-regression.test.mjs
```

The latter builds a small valid synthetic PDF in memory, calls the real local `pdftotext` process, checks extracted text and byte preservation, and tests unsafe DNS and redirect rejection, annotations and contextual local search. It never makes public HTTP calls in tests.

## Integration and limits

- Call `capture(input)`, then persist `result.attachment.bytes` via the library's `attach(name, bytes)` method, append the returned library-relative path to `item.attachments`, and persist `item`. Capture does not write files itself.
- Article fetching uses a native HTTP(S) transport with DNS addresses pinned to the actual connection, rather than unpinned global fetch, to prevent DNS-rebinding attacks. The optional `fetchImpl` and `resolveHost` adapters remain supported for deterministic tests or trusted integrations. Each redirect is revalidated. The implementation rejects nonpublic address ranges, sends no cookies, limits response size and fetch duration, and extracts plain text without executing HTML.
- Extraction is best-effort, not a browser or JavaScript renderer; paywalls, complex HTML and non-UTF-8 pages may yield incomplete content. Preserve the original source URL and annotations on failure. Do not treat link-only as an offline copy.
- PDF extraction is optional, local, bounded and does not provide OCR for scanned images. The original PDF is retained when extraction fails.
- The browser UI, runtime integration and Obsidian round trip belong to the later project-wide release and are not asserted as completed by this server-module contribution.
