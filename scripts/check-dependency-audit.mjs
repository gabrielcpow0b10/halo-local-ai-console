import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function fail(message) {
  console.error(`Dependency audit check failed: ${message}`);
  process.exit(1);
}

function runNpmJson(args, allowedStatuses) {
  const result = spawnSync(npm, args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) fail(`could not run npm ${args.join(" ")}: ${result.error.message}`);
  if (!allowedStatuses.has(result.status)) {
    if (result.stderr) process.stderr.write(result.stderr);
    fail(`npm ${args.join(" ")} exited with status ${result.status}.`);
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    fail(`npm ${args.join(" ")} did not return valid JSON.`);
  }
}

function highOrCriticalEntries(report) {
  if (report.auditReportVersion !== 2 || typeof report.vulnerabilities !== "object") {
    fail("npm returned an unsupported audit JSON structure.");
  }

  return Object.entries(report.vulnerabilities).filter(([, finding]) =>
    ["high", "critical"].includes(finding.severity),
  );
}

const productionAudit = runNpmJson(
  ["audit", "--omit=dev", "--audit-level=high", "--json"],
  new Set([0, 1]),
);
const productionFindings = highOrCriticalEntries(productionAudit);
if (productionFindings.length > 0) {
  console.error(JSON.stringify(Object.fromEntries(productionFindings), null, 2));
  fail("production dependencies contain High or Critical vulnerabilities.");
}

const fullAudit = runNpmJson(
  ["audit", "--audit-level=high", "--json"],
  new Set([0, 1]),
);
const findings = highOrCriticalEntries(fullAudit);

if (findings.length > 0) {
  console.error(JSON.stringify(Object.fromEntries(findings), null, 2));
  fail("the full dependency tree contains High or Critical vulnerabilities.");
}

console.log("Dependency audit passed: no High or Critical vulnerabilities.");
