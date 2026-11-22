# CSV Import Errors: A Practical Preflight Checklist Before Uploading Data

**A free, reproducible guide for developers and data operators (Python 3.10+).**  
Updated: 22 November 2026. By Toyol Digital, Malaysia.

If a data import fails, you often discover the errors only *after* starting the upload: duplicate identifiers, blank mandatory fields, malformed CSV quotations, or inconsistent column counts. A short offline preflight can catch many **structural** issues before import. It does **not** replace the destination application's business rules or relationship checks.

The following steps work for common CSV migration workflows. **They are not a vendor-certified HubSpot, Shopify or ERP validation process.** For application-specific errors, follow the vendor's own requirements:

- [HubSpot: troubleshoot record import errors](https://knowledge.hubspot.com/import-and-export/troubleshoot-import-errors)
- [Shopify: solving customer CSV errors](https://help.shopify.com/en/manual/customers/customer-csv-issues)

## 1. Verify the header and text encoding

Open a *copy* of your source file. Check that it is actually CSV (not an XLSX file renamed to CSV), that the encoding is UTF-8 or UTF-8 with a byte-order mark, and that header names are not blank or duplicated.

Some applications require exact column names; even an extra trailing space can make an expected field appear missing. **Do not strip or rename headers automatically** unless the destination's mapping rules allow it.

## 2. Check the number of columns for every record

The following is a deliberately broken CSV example. Each physical line is one record here, but in general a correctly quoted field can contain a line break and must be parsed with a real CSV parser rather than a simple string split:

```csv
id,name,status
101,Ada,active
101,Ada,active
102,,inactive
103,Farid
```

The last record has two fields while the header expects three. Record 3 has a blank `name`. Records 1 and 2 are identical, and their `id` values repeat.

## 3. Check required fields and unique identifiers

Required fields should be defined **for your import**, not guessed by the tool. If your process requires `id`, `name` and `status`, check each record for blanks in those columns. Decide which fields are genuinely unique. For example, a customer email might be unique in one CRM project but shared by several records in another.

**Important:** A value that looks valid syntactically can still be wrong. This check does not prove financial balances, dates, tax identifiers, owner associations or CRM relationships are correct.

## 4. Produce a repeatable exception report

For the example above, an offline structural checker should surface these **five** findings:

| Finding | Record | Meaning |
| --- | ---: | --- |
| `DUPLICATE_KEY` | 2 | Repeated `id`; first seen in record 1 |
| `DUPLICATE_ROW` | 2 | Exact full-row duplicate of record 1 |
| `MISSING_REQUIRED_VALUE` | 3 | Blank `name` |
| `ROW_WIDTH` | 4 | Two values where three are expected |
| `MISSING_REQUIRED_VALUE` | 4 | Absent `status` value |

Here, a **record number** counts data records after the header; it is not always the same as the physical line number when a quoted cell spans multiple lines.

A machine-readable report is more useful than a screenshot if the import will be repeated or checked by several people.

## 5. Run a tested offline Python CLI (optional, paid)

**Toyol CSV Quality Gate v1.1** is a standalone Python 3.10+ command-line tool for this structural preflight. It does not call external APIs or require third-party packages.

After purchasing and extracting the ZIP, the command for a file named `sample_issues.csv` is:

```bash
python csv_quality_gate.py sample_issues.csv --required name,status --unique id --output audit_report.json
```

The tool writes a JSON report with finding codes, record numbers, counts and a SHA-256 fingerprint of the input file. It omits the raw cell values from its findings. Its v1.1 bundle includes a test suite with **28 passing automated tests**, example input/output, bilingual English and Malay instructions, and a commercial-use license.

- **[View the free example JSON report](../offers/sample_report_v1_1.json)**.
- **[View the live Getly product — USD49, one-time ZIP download](https://www.getly.store/product/toyol-csv-quality-gate-v1-0-offline-csv-validation-toolkit)**.
- **[View the Getly seller store](https://www.getly.store/store/toyol-digital-mwqb0ono?sref=toyol-digital-mwqb0ono)**.

The software **does not repair CSV files**, open XLSX workbooks, handle CRM mapping or certify that an import meets a vendor's rules. It identifies specific structural problems for a person to review.

## 6. When you need a one-file report instead

For a team that does not want to operate a CLI, Toyol Digital also offers a [fixed-scope RM249 pre-import CSV audit pilot](../offers/csv-preflight-rm249.md): one UTF-8 CSV up to 20,000 data records and 50 columns. Scope, secure data handling and payment terms are agreed before accessing any actual customer dataset.

**Privacy:** Never post identifiable customer records, passwords, healthcare information or other confidential source data in a public issue or email attachment. Use **synthetic data** for an initial demonstration.

---

**Disclosure:** This free troubleshooting guide is published by the seller of Toyol CSV Quality Gate. Links to its product are commercial links, not an independent endorsement. No claim of proven sales or guaranteed import success is made.
