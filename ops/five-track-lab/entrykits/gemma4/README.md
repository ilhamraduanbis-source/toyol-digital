# Toyol Gemma 4 coding-agent submission candidate (23 November 2026)

Original agent configuration, original system instructions, deterministic submission.zip packager and unit tests. Uses the organiser's specified model gemma-4-31b-it-qat-w4a16-ct and nine standard harness tools. No adapter or secret required for packaging.

To build in a clone: cd ops/five-track-lab/entrykits/gemma4 && python -m unittest -v test_package.py && python package.py --out dist/submission.zip

**CRITICAL**: The package is only an agent configuration. It does not run inference or the official Kaggle evaluation, and is not proof of competition eligibility, enrollment, scoring or entry. Before 25 November 2026 23:59 UTC, the human competitor must accept Kaggle rules. A legitimate Kaggle notebook or official evaluator must run the allowed Gemma 4 model with this config and test it; submission requires an authenticated Kaggle account. Never submit only an unevaluated mock and imply it wins.
