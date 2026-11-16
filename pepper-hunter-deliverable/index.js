/**
 * Toyol Paid Tasks Tracker
 * Real money received: RM0
 */

const tasks = [
  {
    title: "FEATURE share daily (week day only) jobs on twitter",
    bountyUSD: 100,
    source: "https://github.com/golang-cafe/job-board/issues/97",
    platform: "Jobbi / algora",
    warnings: "none"
  },
  {
    title: "Multi-account financial overview dashboard",
    bountyUSD: 200,
    source: "https://github.com/rohitdash08/FinMind/issues/132",
    platform: "Jobbi / algora",
    warnings: "MANY_EXISTING_DISCUSSIONS,NO_RECENT_ACTIVITY_90D"
  },
  {
    title: "Jira Service Management Connector",
    bountyUSD: 250,
    source: "https://github.com/onyx-dot-app/onyx/issues/2281",
    platform: "Jobbi / algora",
    warnings: "MANY_EXISTING_DISCUSSIONS"
  },
  {
    title: "Sample: Dozer + LLM + Vector database + Langchain sample",
    bountyUSD: 250,
    source: "https://github.com/getdozer/dozer/issues/1690",
    platform: "Jobbi / algora",
    warnings: "MANY_EXISTING_DISCUSSIONS"
  }
];

function main() {
  console.log("🧟 Toyol — Paid Tasks Radar");
  console.log("REAL MONEY RECEIVED: RM0. ADVERTISED REWARDS ARE NOT EARNINGS.\n");
  console.log("Loaded tasks:", tasks.length);
  tasks.forEach((t, i) => {
    console.log(`${i + 1}. [${t.bountyUSD} USD] ${t.title} (${t.platform})`);
  });
}

if (require.main === module) {
  main();
}

module.exports = { tasks };
