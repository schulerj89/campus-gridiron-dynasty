import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const packageLock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const versionSource = fs.readFileSync("src/version.ts", "utf8");
const changelog = fs.readFileSync("CHANGELOG.md", "utf8");

const packageVersion = packageJson.version;
const lockVersion = packageLock.version;
const lockRootVersion = packageLock.packages?.[""]?.version;
const appVersion = versionSource.match(/APP_VERSION\s*=\s*"v([^"]+)"/)?.[1];
const latestChangelogVersion = changelog.match(/^##\s+([0-9]+\.[0-9]+\.[0-9]+)\s+-/m)?.[1];

const checks = [
  ["package-lock version", lockVersion],
  ["package-lock root package version", lockRootVersion],
  ["src/version.ts APP_VERSION", appVersion],
  ["latest CHANGELOG heading", latestChangelogVersion],
];

const failures = checks
  .filter(([, value]) => value !== packageVersion)
  .map(([label, value]) => `${label} is ${value ?? "missing"}, expected ${packageVersion}`);

if (failures.length) {
  console.error("Release version check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Release version check passed for ${packageVersion}.`);
