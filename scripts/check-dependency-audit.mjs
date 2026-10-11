import { spawnSync } from "node:child_process";

const exception = {
  advisory: "GHSA-vfj7-8cjw-p6xm",
  expires: "2026-11-15",
  path: [
    ["eslint-config-next", "16.4.0"],
    ["@next/eslint-plugin-next", "16.4.0"],
    ["fast-glob", "3.3.1"],
    ["micromatch", "4.0.8"],
    ["braces", "3.0.3"],
  ],
};

const expectedPropagation = new Map([
  ["eslint-config-next", "@next/eslint-plugin-next"],
  ["@next/eslint-plugin-next", "fast-glob"],
  ["fast-glob", "micromatch"],
  ["micromatch", "braces"],
]);
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

function dependencyPaths(tree, target, path = []) {
  const matches = [];
  for (const [name, details] of Object.entries(tree.dependencies ?? {})) {
    const nextPath = [...path, [name, details.version]];
    if (name === target) matches.push(nextPath);
    matches.push(...dependencyPaths(details, target, nextPath));
  }
  return matches;
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

const productionTree = runNpmJson(
  ["ls", "braces", "--omit=dev", "--all", "--json"],
  new Set([0, 1]),
);
if (dependencyPaths(productionTree, "braces").length > 0) {
  fail("braces is present in the production dependency tree.");
}

const fullAudit = runNpmJson(
  ["audit", "--audit-level=high", "--json"],
  new Set([0, 1]),
);
const findings = highOrCriticalEntries(fullAudit);

if (findings.length === 0) {
  console.log(
    "Dependency audit passed: no High or Critical vulnerabilities; the temporary braces exception was not needed.",
  );
  process.exit(0);
}

const expiryInstant = Date.parse(`${exception.expires}T23:59:59.999Z`);
if (Date.now() > expiryInstant) {
  fail(`the temporary ${exception.advisory} exception expired on ${exception.expires}.`);
}

const findingNames = new Set(findings.map(([name]) => name));
const expectedNames = new Set([...expectedPropagation.keys(), "braces"]);
if (
  findingNames.size !== expectedNames.size ||
  [...findingNames].some((name) => !expectedNames.has(name))
) {
  console.error(JSON.stringify(Object.fromEntries(findings), null, 2));
  fail("the High/Critical findings do not match the expected braces propagation chain.");
}

for (const [name, expectedVia] of expectedPropagation) {
  const finding = fullAudit.vulnerabilities[name];
  if (
    finding.name !== name ||
    finding.severity !== "high" ||
    finding.via.length !== 1 ||
    finding.via[0] !== expectedVia
  ) {
    fail(`${name} does not exclusively derive from the expected braces advisory chain.`);
  }
}

const bracesFinding = fullAudit.vulnerabilities.braces;
const advisoryUrl = `https://github.com/advisories/${exception.advisory}`;
if (
  bracesFinding.name !== "braces" ||
  bracesFinding.severity !== "high" ||
  bracesFinding.via.length !== 1 ||
  typeof bracesFinding.via[0] !== "object" ||
  bracesFinding.via[0].name !== "braces" ||
  bracesFinding.via[0].dependency !== "braces" ||
  bracesFinding.via[0].severity !== "high" ||
  bracesFinding.via[0].url !== advisoryUrl
) {
  fail(`the braces finding is not exactly advisory ${exception.advisory}.`);
}

const fullTree = runNpmJson(["ls", "braces", "--all", "--json"], new Set([0]));
const bracesPaths = dependencyPaths(fullTree, "braces");
if (
  bracesPaths.length !== 1 ||
  JSON.stringify(bracesPaths[0]) !== JSON.stringify(exception.path)
) {
  console.error(`Observed braces paths: ${JSON.stringify(bracesPaths)}`);
  fail("braces is not installed at the single expected dev-only version and path.");
}

console.warn(
  [
    "Dependency audit passed with a TEMPORARY DEV-ONLY EXCEPTION.",
    `Known vulnerability still present: braces@3.0.3 (${exception.advisory}, High).`,
    `Path: ${exception.path.map(([name, version]) => `${name}@${version}`).join(" -> ")}.`,
    `braces is absent from the production tree. Exception expires ${exception.expires}.`,
  ].join("\n"),
);
