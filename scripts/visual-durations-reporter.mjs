// A Playwright reporter that writes only how long each test took, for the
// shard plan (scripts/visual-shards.mjs). CI's visual-report job runs it over
// the merged blobs:
//
//   npx playwright merge-reports --reporter ./scripts/visual-durations-reporter.mjs ./all-blob-reports
//
// The JSON reporter can't do this job: it puts every screenshot in one string,
// which is longer than Node allows for the full suite.
import { writeFileSync } from "node:fs";
import {
  durationKey,
  recordDuration,
  sortedDurations,
} from "./visual-shards.mjs";

export default class VisualDurationsReporter {
  constructor(options = {}) {
    this.out =
      process.env.VISUAL_DURATIONS_OUT ??
      options.outputFile ??
      "durations.json";
    this.times = {};
    this.passed = new Set();
  }
  printsToStdio() {
    return false;
  }
  onTestEnd(test, result) {
    recordDuration(
      this.times,
      this.passed,
      durationKey(test.titlePath()),
      result,
    );
  }
  onEnd() {
    const d = sortedDurations(this.times);
    writeFileSync(this.out, JSON.stringify(d, null, 2) + "\n");
    const minutes = Object.values(d).reduce((a, b) => a + b, 0) / 60;
    console.error(
      `${Object.keys(d).length} tests, ${Math.round(minutes)} min in all, written to ${this.out}`,
    );
  }
}
