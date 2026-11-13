# Workspace verification and integration notes

Node 22+ and a modern browser are required. No browser-side libraries, cloud fonts, telemetry or account are required.

The frozen customer check is unchanged. To exercise a real browser with synthetic content and a loopback API fixture:

```sh
npm install --prefix /tmp/hobby-ui-test playwright@1.56.1
/tmp/hobby-ui-test/node_modules/.bin/playwright install chromium --with-deps
PLAYWRIGHT_MODULE=/tmp/hobby-ui-test/node_modules/playwright node test/ui/browser-smoke.mjs
```

The browser test uses actual Chromium and the committed UI, not screenshots or a simulated DOM. The API fixture is only a test double, not the final persistence runtime.

Integration assumptions:
- GET /api/items returns {items: records}; GET /api/graph returns {nodes,edges,unresolved}; GET /api/items/:id and POST /api/items return a record (or {record}). Revision conflicts use HTTP 409; the draft remains in the editor.
- POST /api/capture uses the contracted fields; browser attachment bytes are serialized as a JSON array of unsigned bytes. The runtime adapter should validate the length and byte range and reconstruct a Buffer for capture(input). Serve library-relative attachments at /attachments/<name> on localhost only. The browser does not upload to any external host.
- Search results refer to existing item IDs. The preview renders Markdown headings, lists, checklists and links using DOM text nodes rather than untrusted HTML. It is a deliberately limited preview, not a complete CommonMark renderer.
- The graph focuses on one node and its direct incoming/outgoing neighbors; unresolved/ambiguous references are listed separately. The shared graph module supports arbitrary nonnegative neighborhood depth.
- Real disk persistence, PDF/image serving, offline restart, export/restore, external-edit recovery and an Obsidian round trip must still be verified in the final local-runtime release. No such release claim is made here.
