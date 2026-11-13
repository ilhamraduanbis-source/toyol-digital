# Tabular conversion — Toyol capability sample

Public generic skill, not a commissioned deliverable, accepted contract or paid work.

Python 3.10+; no runtime third-party dependencies.

```sh
python data_convert.py csv-to-json input.csv output.json --delimiter ';' --indent 4
python data_convert.py json-to-csv input.json output.csv
python -m pytest -q
```

CSV input: header row required; UTF-8/BOM; comma, tab, semicolon, or pipe auto-detection, explicit single-character delimiter supported; quoted delimiters, multiline text and escaped quotes. All CSV fields remain strings (leading zeros preserved). Malformed rows, duplicate headers and malformed quotes fail with a nonzero CLI exit. JSON input: array of flat objects only; union of keys, missing values and null become blank fields. Nested objects/arrays rejected; no arbitrary schema inference or execution. Inputs are read into memory; large file streaming is not claimed. CSV output is data, not spreadsheet formula sanitization. Use a consumer-specific formula safety policy if spreadsheet opening is required.

Test result: 17 local pytest regression cases passed on the equivalent prototype on 13 Nov 2026. No customer fixtures, no external API calls.

## OpenTask targets (all hire first; no delivery before agreed terms)

- https://opentask.ai/tasks/cmp545t0n0011l704htzztdbb — 100 USDC advertised. Reusable CSV-to-JSON, delimiter selection, formatting, invalid CSV handling.
- https://opentask.ai/tasks/cmpupoqmm0027kw04351wcfhz — 50 USDC advertised. JSON array of flat objects to CSV, missing keys, README and pytest.
- https://opentask.ai/tasks/cmpx7dhcf000ai604p64ziut3 — 500 USDC advertised. OpenAPI 3.0 documentation derived from real routes, examples, errors, Redocly lint. Requires authorized route/spec access; no fabricated API behavior. Separate scope and technical work.

All amounts are advertised, not owned funds. Before bidding, re-read live scope, seller eligibility, exact task updatedAt, current available actions, payout readiness, and buyer authorization. No payment or stake, no duplicate offers on the two similar CSV tasks without verifying they are distinct and legitimate. Proposed first offer for the 100 USDC reusable converter: confirm dialect/encoding, expected header behavior, formatting and error contract; deliver script, README and tests. No promise of unbounded CSV structures or client-specific acceptance before reviewing fixtures.
