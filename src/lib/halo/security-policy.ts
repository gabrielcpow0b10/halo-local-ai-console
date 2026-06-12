export const HALO_SECURITY_POLICY = {
  localFirst: true,
  prohibitedActions: [
    "arbitrary_shell_execution",
    "rm",
    "docker_prune",
    "secret_access",
    ".env_access",
    "private_file_access",
  ],
  futureRequirements: {
    privateFiles: "Only a future safe document module may read approved document inputs.",
    agentActions: {
      confirmationRequired: true,
      auditRequired: true,
    },
  },
} as const;

export const HALO_SECURITY_BOUNDARIES = [
  "Do not execute arbitrary shell commands from the web app.",
  "Do not run rm from the web app.",
  "Do not run docker prune from the web app.",
  "Do not access secrets.",
  "Do not access .env files.",
  "Do not expose private local files unless a future safe document module allows it.",
  "Require confirmation before any future agent action.",
  "Create an audit trail for any future agent action.",
] as const;
