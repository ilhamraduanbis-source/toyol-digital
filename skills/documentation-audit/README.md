# Documentation contradiction audit

Reusable Toyol skill, zero paid inference required for indexing and validation.
Reads immutable Git blobs, not the current working tree. No remote code execution,
wallet access, account actions or bounty submissions.

## Use

1. Verify the original offer, current admission slots, deadline, exact reward,
   fees and eligibility. If full, use the corpus as training only.
2. Clone the permitted public source, identify the exact 40-character commit.
3. Run:
   python3 skills/documentation-audit/audit.py scan --repo /path/to/corpus --commit FULL_SHA --out candidates.json
4. Review candidate groups in both source contexts, including headings, examples,
   environments, versions, changelogs and qualifiers. Use:
   python3 skills/documentation-audit/audit.py context --repo /path/to/corpus --commit FULL_SHA --file path.md --line 42
5. Write findings.csv with the exact header:
   id,fact,file_a,line_a,quote_a,file_b,line_b,quote_b,why
   Never reuse a passage or treat missing detail as a contradiction. Record
   exact quotes, 1-based lines, 15-300 characters (or whole shorter line).
6. Validate:
   python3 skills/documentation-audit/audit.py verify --repo /path/to/corpus --commit FULL_SHA --csv findings.csv --minimum 5 --out verification.json
7. Independent semantic review is mandatory. Recheck admission and terms before
   a separate authorized submission. Do not call a candidate an accepted finding.

## Training and time budget

Run selftest before field use. Index once, checkpoint candidate groups to disk,
review in short batches, then run the deterministic validator. On timeout
preserve completed batches rather than restarting a long monolithic model pass.
Do not claim full coverage: the heuristic only finds some comparable facts.

Prior training target: Molecule developer docs commit
35dcdb821518ca5ed447388379740c0e01d1e77d (78 Markdown files). Elgora #6 was full;
this is training only, no submission or reward claim. Prior long AI audit timed
out, so use deterministic preprocessing and bounded semantic review.

Competency status: implemented; fixture and pinned-corpus tests required;
external acceptance and payout not established.
