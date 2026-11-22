# Kane CLI original ProofDesk acceptance test

Test target: local ProofDesk dashboard from the existing Toyol Five Track Lab ZIP. This is a test specification, **not a Kane CLI execution transcript**.

1. Opening ProofDesk shows exactly five registered opportunity cards (not claimed contest enrollments).
2. Clicking Smart glasses filters to one Even Realities card.
3. Clicking All restores five entries.
4. Clicking Next HUD card updates HUD progress to 2/5.
5. Empty prompt + Run device-first simulation produces prompt-required validation.
6. A prompt with the cloud checkbox enabled still reports no cloud calls when free quota was not verified.
7. Export local status JSON includes five unique lanes and zero asserted confirmed registrations.

The official hackathon requires authentic Kane CLI testing, a TestMu account, a public GitHub project, a demonstration video, and two public posts. Playwright tests are not interchangeable with Kane logs.
