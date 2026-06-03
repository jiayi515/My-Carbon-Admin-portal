/* global */
// ─────────────────────────────────────────────────────────────
// Carbon — Fault Code Knowledge Base (mock)
// A server-maintained dictionary that maps a fault code to its
// canonical meaning + recommended actions + fleet-wide statistics.
// When a ticket is auto-created with a known fault code, the cloud
// looks the code up here and stores the result in the ticket so the
// workbench can render it without any extra fetch.
//
// Three domains supported:
//   • payment  · EMV hex codes (0x6985, 0x6F00…)
//   • device   · component-level codes (printer.cutter-fail…)
//   • security · tamper / integrity codes
// ─────────────────────────────────────────────────────────────

const FAULT_CODE_KB = {
  // ───────── Payment domain ─────────
  "0x6F00": {
    code: "0x6F00",
    domain: "payment",
    shortMessage: "EMV kernel timeout",
    likelyCause: "Secure-element clock drift causes GENERATE AC to exceed the 600 ms ceiling; commonly seen on N950 + CB-EMVL2 v2.1.4–v2.1.5.",
    severity: "warning",
    recommendedSteps: [
      "Open device monitoring → System → confirm Auto-time is enabled.",
      "If Auto-time is OFF, force NTP re-sync from the system tray.",
      "Restart the POS Pro service (Apps → restart) and retry the transaction.",
      "If errors persist, escalate to NPT for SE firmware inspection.",
    ],
    docLink: "KB-1428",
    affected: { kernels: ["CB-EMVL2 v2.1.4", "CB-EMVL2 v2.1.5"], models: ["N950"] },
    fleetStats: { window: "7d", count: 142, merchants: 3, devices: 18 },
    feedback: { helpful: 84, total: 100 },
  },
  "0x6985": {
    code: "0x6985",
    domain: "payment",
    shortMessage: "Conditions of use not satisfied",
    likelyCause: "AID priority configuration drift on the Visa ICC kernel — the terminal is offering an AID the issuer's policy doesn't accept.",
    severity: "warning",
    recommendedSteps: [
      "Open device monitoring → Security module switches → confirm Insert (chip) is enabled.",
      "Re-collect telemetry to refresh the ICC kernel state.",
      "If still failing, escalate to NPT — they have an internal tool to re-deploy AID priorities.",
    ],
    docLink: "KB-3201",
    affected: { kernels: ["CB-ICCL2 v1.8.x"], models: ["S60", "N950"] },
    fleetStats: { window: "7d", count: 38, merchants: 5, devices: 11 },
    feedback: { helpful: 71, total: 88 },
  },

  // ───────── Device domain ─────────
  "printer.cutter-fail": {
    code: "printer.cutter-fail",
    domain: "device",
    shortMessage: "Receipt was not fully cut",
    likelyCause: "Cutter motor wear — common after ~250K cuts on the X800 print head.",
    severity: "warning",
    recommendedSteps: [
      "Pull the print-head log: count total cuts (system param: printer.cuts_total).",
      "If > 200 000, this is mechanical wear → RMA the cutter assembly.",
      "If < 200 000, escalate to NPT to inspect the firmware (cutter step calibration).",
    ],
    docLink: "KB-3014",
    affected: { kernels: [], models: ["X800"] },
    fleetStats: { window: "7d", count: 12, merchants: 8, devices: 12 },
    feedback: { helpful: 22, total: 28 },
  },
  "network.ethernet-flap": {
    code: "network.ethernet-flap",
    domain: "device",
    shortMessage: "Ethernet link flapped repeatedly",
    likelyCause: "PoE switch port instability — typically resolves on its own; recurring overnight flaps point to switch hardware.",
    severity: "info",
    recommendedSteps: [
      "If flap recurs the following night, ask the merchant to check the PoE switch port.",
      "If transactions failed during the flap, schedule a replacement of the switch.",
      "Otherwise, no further action.",
    ],
    docLink: "KB-1809",
    affected: { kernels: [], models: ["X800", "N950"] },
    fleetStats: { window: "7d", count: 5, merchants: 4, devices: 5 },
    feedback: { helpful: 18, total: 24 },
  },

  // ───────── Security domain ─────────
  "security.rooted-bootloader-unlock": {
    code: "security.rooted-bootloader-unlock",
    domain: "security",
    shortMessage: "Bootloader unlocked — device rooted",
    likelyCause: "TOMS integrity check matched a bootloader unlock signature. PCI policy requires immediate quarantine and an attestation reset before re-binding.",
    severity: "critical",
    recommendedSteps: [
      "Quarantine the device from the production fleet (Devices → Bind → Unbind).",
      "Audit the last 24 h of transactions for this SN with the merchant.",
      "Escalate to NPT — only Engineering can issue an attestation reset.",
    ],
    docLink: "POL-0017",
    affected: { kernels: [], models: ["N750", "N950", "S60"] },
    fleetStats: { window: "7d", count: 1, merchants: 1, devices: 1 },
    feedback: { helpful: 19, total: 20 },
  },
};

// Lookup helper — returns null if the code isn't catalogued.
function faultCodeLookup(code) {
  if (!code) return null;
  return FAULT_CODE_KB[code] || null;
}

Object.assign(window, { FAULT_CODE_KB, faultCodeLookup });
