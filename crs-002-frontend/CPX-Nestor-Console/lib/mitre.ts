// Enter the technique ID, the name derives. An invented technique name,
// a technique with no ID, and a tactic under the wrong heading are
// unrepresentable when the ID is the key.

export const TACTICS: Record<string, string> = {
  TA0001: "Initial Access",
  TA0002: "Execution",
  TA0003: "Persistence",
  TA0004: "Privilege Escalation",
  TA0005: "Defense Evasion",
  TA0006: "Credential Access",
  TA0007: "Discovery",
  TA0008: "Lateral Movement",
  TA0009: "Collection",
  TA0010: "Exfiltration",
  TA0011: "Command and Control",
  TA0040: "Impact",
};

export const TECHNIQUES: Record<string, { name: string; tactics: string[] }> = {
  T1190: { name: "Exploit Public-Facing Application", tactics: ["TA0001"] },
  T1566: { name: "Phishing", tactics: ["TA0001"] },
  "T1195.002": { name: "Compromise Software Supply Chain", tactics: ["TA0001"] },
  T1059: { name: "Command and Scripting Interpreter", tactics: ["TA0002"] },
  "T1505.003": { name: "Web Shell", tactics: ["TA0003"] },
  "T1562.001": { name: "Disable or Modify Tools", tactics: ["TA0005"] },
  T1555: { name: "Credentials from Password Stores", tactics: ["TA0006"] },
  "T1021.001": { name: "Remote Desktop Protocol", tactics: ["TA0008"] },
  "T1567.002": { name: "Exfiltration to Cloud Storage", tactics: ["TA0010"] },
  T1486: { name: "Data Encrypted for Impact", tactics: ["TA0040"] },
  T1071: { name: "Application Layer Protocol", tactics: ["TA0011"] },
  T1041: { name: "Exfiltration Over C2 Channel", tactics: ["TA0010"] },
};

export function resolveTechnique(id: string) {
  return TECHNIQUES[id.trim().toUpperCase()] ?? null;
}
