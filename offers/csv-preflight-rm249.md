# Toyol Digital — CSV pre-import QA pilot

**Fixed pilot price: RM249** (one file, quote agreed before any confidential data is transferred).

A small, independent, **validation-only** check for teams preparing bulk imports into a database, ERP, CRM, e-commerce store or a legacy-to-cloud migration.

## The pilot includes

- **Input:** one UTF-8 CSV file, up to **20,000 data records and 50 columns**; mandatory columns and unique identifiers supplied by the client.
- **Checks:** empty or duplicate headers, missing required columns and values, duplicate keys and complete rows, inconsistent column counts, malformed encoding and CSV, and configured row-limit breaches.
- **Deliverables:** reproducible machine-readable JSON finding report with record positions, totals and input SHA-256 fingerprint; concise issue summary and suggested manual next checks.
- **Privacy:** offline Python execution with no third-party dependencies or network calls. Reports do not include raw record values. Customer data must be sent only over a separately agreed secure process; **please do not email customer or sensitive records**.
- **Testing evidence:** bundled v1.1 automated test suite passes **28 of 28** tests. Separately tested on synthetic data containing **100,000 rows**. Passing a finite test suite does not guarantee all inputs are error-free.

## Not included

No automated cleaning, normalization, deduplication resolution, XLSX handling, DB schema design, CRM/ERP mapping, regulatory compliance assessment, financial reconciliations, account balance checking or live system migration.

The pilot does not assert that a CSV is ready for import into any particular product. It finds structural anomalies for a human to review.

## Sample report

[Example JSON report](sample_report_v1_1.json) — generated with v1.1 from a **synthetic** CSV containing 4 records and 5 findings. No customer data.

## How to start

Contact Toyol Digital with only the **non-sensitive** source-system type, approximate row and column counts, and the desired required/unique fields. We first agree scope, price, payment method and data handling; then proceed only with authorized data.

**Toyol Digital — Malaysia.**
