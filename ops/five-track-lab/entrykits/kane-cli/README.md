# KaneCLI competition testing: zero-spend gated real CLI runner

This is a prepared **manual GitHub Actions** workflow, not a completed Kane test. Real TestMu account and 10,000 free credits must be confirmed before running; the workflow otherwise fails closed.

1. Register for the contest at https://www.kaneclihack.sh/o/register (separate from TestMu account).
2. Register for free credits at https://www.testmuai.com/kane-cli/ . Verify the actual free-credit balance in the account dashboard. Do NOT add a card or subscribe to a paid tier.
3. In GitHub repository settings, add the official account's **LT_USERNAME** and **LT_ACCESS_KEY** as **Actions secrets**, never paste them in ChatGPT or commit them. Restrict repository access; rotate keys if needed.
4. Start https://github.com/ilhamraduanbis-source/toyol-digital/actions/workflows/toyol-kanecli-contest.yml with `free_credits_confirmed=true` only if free credits are verified. The workflow installs the real official Kane CLI, runs a bounded headless test against the public ProofSafe frontend and stores its genuine NDJSON output.
5. Obtain an authentic Kane result; only if the CLI actually passes can this be claimed as genuine Kane testing. A nonzero exit means FAIL, not 'close enough'.

**Important hackathon conditions:** See the actual rules; a TestMu account and proper free-credit claim are mandatory; public project/video and two public posts appear in requirements. Existing Toyol 'avoid social media' preference conflicts with the latter, so review rules before investing more. Submission deadline 26 November 2026, 11:59pm IST (27 November 2:29am Malaysia).

The frontend requires no Firebase configuration for basic UI tests; the Kane result is not proof of Firebase AI inference and does not claim a contest prize. No paid API, card or funds are used by the workflow design.
