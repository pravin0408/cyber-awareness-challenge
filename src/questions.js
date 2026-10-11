/**
 * questions.js
 * Complete 10-question cybersecurity awareness dataset.
 * Each question covers a real-world attack vector with four options,
 * one correct answer key, and an educational rationale.
 *
 * Exported as an array for both browser (global) and Node (module) consumption.
 */

const QUESTIONS = [
  {
    id: 1,
    category: "Spear Phishing / Email Header Analysis",
    question:
      "You receive an email from 'ceo@yourcompany.com' asking you to urgently wire $50,000. The 'Reply-To' header points to 'ceo-finance@protonmail.com' and the SPF check shows 'softfail'. What is the BEST immediate action?",
    options: [
      "A) Reply to confirm the request since the From address looks legitimate",
      "B) Forward the email to your personal Gmail for a second opinion",
      "C) Do NOT reply; report the email to your security team and verify the request through an out-of-band channel (phone call to the CEO)",
      "D) Click the link in the email to check if the landing page looks real",
    ],
    correctIndex: 2,
    rationale:
      "The mismatch between the From address and Reply-To header, combined with SPF softfail, are classic indicators of a Business Email Compromise (BEC) attack. Always verify through an independent, out-of-band channel such as a direct phone call. Never trust email headers alone for authentication of financial requests.",
  },
  {
    id: 2,
    category: "MFA Fatigue / Push Notification Attack",
    question:
      "At 2 AM, you receive 14 consecutive MFA push notifications on your authenticator app, even though you are not trying to log in. What is happening, and what should you do?",
    options: [
      "A) Approve one of the push notifications to stop the bombardment",
      "B) Ignore all prompts, immediately change your password from a secure device, and report the incident to your IT security team",
      "C) Uninstall the authenticator app to stop the notifications",
      "D) Assume it is a system glitch and go back to sleep",
    ],
    correctIndex: 1,
    rationale:
      "This is an MFA Fatigue (push bombing) attack. Attackers who already have your credentials repeatedly trigger MFA prompts, hoping you will approve one out of frustration or confusion. Never approve unexpected prompts. Change your password immediately from a known-safe device and report the activity so the security team can investigate the credential compromise.",
  },
  {
    id: 3,
    category: "Social Engineering / Vishing (Voice Phishing)",
    question:
      "You receive a phone call from someone claiming to be Microsoft Support. They say your computer has been 'sending error reports' and ask you to install a remote access tool (AnyDesk) so they can 'fix' it. What should you do?",
    options: [
      "A) Install AnyDesk and let them fix the issue since they quoted your Windows license key",
      "B) Hang up immediately — Microsoft never makes unsolicited support calls; report the number to your security team",
      "C) Give them your password so they can log in remotely",
      "D) Ask them to email you the fix instead",
    ],
    correctIndex: 1,
    rationale:
      "Microsoft and other major vendors never make unsolicited technical support calls. This is a classic vishing (voice phishing) attack designed to install remote access trojans (RATs) on your machine. Attackers often spoof caller IDs and may reference publicly available license information. Always hang up and report.",
  },
  {
    id: 4,
    category: "Supply Chain / Typosquatting (NPM/PyPI)",
    question:
      "A developer on your team runs `npm install colours` (note the British spelling) instead of the legitimate `npm install colors`. The typosquatted package executes a post-install script. What is the PRIMARY risk?",
    options: [
      "A) The package will simply not work since the name is different",
      "B) The post-install script can execute arbitrary code with the developer's system privileges, potentially exfiltrating environment variables, SSH keys, and CI/CD tokens",
      "C) NPM automatically blocks all typosquatted packages",
      "D) The British spelling is the official package and is safe to use",
    ],
    correctIndex: 1,
    rationale:
      "Typosquatting is a supply chain attack where malicious packages are published with names very similar to popular ones. Post-install scripts run with full user privileges and can steal secrets (AWS keys, SSH keys, .env files), install backdoors, or inject crypto miners. Always verify package names, check download counts, and use lockfiles with integrity hashes.",
  },
  {
    id: 5,
    category: "Credential Hygiene / Password Security",
    question:
      "A data breach notification reveals that your email appeared in a dump of 2 million credentials from a third-party service. You use the same password for that service and your corporate VPN. What is the correct remediation sequence?",
    options: [
      "A) Only change the password on the breached service",
      "B) Immediately change passwords on ALL services where that password was reused, enable MFA everywhere possible, check HaveIBeenPwned for other exposures, and notify your security team about the corporate VPN credential",
      "C) Wait for your IT department to force a password reset",
      "D) Add a '1' to the end of your existing password on all services",
    ],
    correctIndex: 1,
    rationale:
      "Credential stuffing attacks use breached username/password pairs across multiple services. If you reused the password, ALL accounts using it are compromised. The correct response is to change every reused password to a unique one (use a password manager), enable MFA, check HaveIBeenPwned, and alert your security team about any corporate credential exposure.",
  },
  {
    id: 6,
    category: "QR Code Quishing",
    question:
      "In your office lobby, someone has placed a QR code sticker over the legitimate Wi-Fi QR code on the reception desk. Scanning it opens a browser page that looks exactly like your company's SSO login portal. What is this attack called, and what should you do?",
    options: [
      "A) This is 'Quishing' (QR phishing) — do NOT enter credentials; report the tampered QR code to physical security and IT immediately",
      "B) It is safe because QR codes cannot contain malicious content",
      "C) Enter your credentials since the page has your company logo",
      "D) Scan it again to double check — QR codes change their destination each scan",
    ],
    correctIndex: 0,
    rationale:
      "Quishing (QR phishing) uses physical QR codes to redirect victims to credential-harvesting pages. Placing malicious QR stickers over legitimate ones in high-traffic areas is a common physical social engineering vector. Always verify URLs before entering credentials, and report suspicious physical modifications to security.",
  },
  {
    id: 7,
    category: "Ransomware / Incident Response",
    question:
      "You open your laptop Monday morning and see a full-screen message: 'Your files have been encrypted. Send 2 BTC to [address] within 72 hours or your data will be published.' Your desktop wallpaper has been changed to a ransom note. What is the correct FIRST action?",
    options: [
      "A) Pay the ransom immediately to recover your files before the deadline",
      "B) Disconnect the machine from the network immediately (unplug Ethernet / disable Wi-Fi), do NOT power off, and contact your incident response team",
      "C) Run a full antivirus scan and continue working while it finishes",
      "D) Format the hard drive immediately to remove the malware",
    ],
    correctIndex: 1,
    rationale:
      "The first action in a ransomware incident is to isolate the infected machine by disconnecting it from the network to prevent lateral movement. Do NOT power off (volatile memory may contain decryption keys or forensic artifacts). Do NOT pay the ransom (no guarantee of recovery, funds further criminal operations). Contact your incident response team immediately for proper containment, eradication, and recovery.",
  },
  {
    id: 8,
    category: "Insider Threat / Data Exfiltration",
    question:
      "Your DLP (Data Loss Prevention) system alerts that an employee in the finance department has uploaded 4.2 GB of files labeled 'CONFIDENTIAL' to a personal Google Drive at 11:47 PM on a Friday. The employee submitted their resignation letter 3 days ago. What risk does this represent?",
    options: [
      "A) No risk — employees are allowed to keep personal copies of their work",
      "B) This is a high-severity insider threat indicator; immediately escalate to your security operations center, preserve logs, and coordinate with HR and Legal for investigation",
      "C) Block the employee's email and take no further action",
      "D) Wait until Monday to review the situation during business hours",
    ],
    correctIndex: 1,
    rationale:
      "This scenario combines multiple insider threat indicators: large data transfer, confidential classification, unusual timing (late Friday night), and recent resignation. This is a textbook data exfiltration pattern. Immediate escalation, log preservation, and coordinated response with SOC, HR, and Legal is required. Time-sensitive evidence may be lost if action is delayed.",
  },
  {
    id: 9,
    category: "Zero Trust / Network Security",
    question:
      "Your company's new Zero Trust architecture policy states: 'Never trust, always verify.' A contractor plugs their personal laptop into the corporate Ethernet port in a conference room. Under Zero Trust principles, what should happen?",
    options: [
      "A) The laptop should get full network access since it is physically inside the building",
      "B) The network should authenticate the device, verify its security posture (patching, EDR, certificates), authenticate the user's identity, and only grant access to the specific resources the contractor is authorized for — denying everything else by default",
      "C) The contractor should be given the Wi-Fi password instead",
      "D) Physical access to the building equals trusted status on the network",
    ],
    correctIndex: 1,
    rationale:
      "Zero Trust eliminates implicit trust based on network location. Every access request must be authenticated, authorized, and continuously validated regardless of whether the device is inside or outside the corporate perimeter. Device posture assessment, identity verification, and least-privilege access are mandatory. Physical presence alone grants zero trust.",
  },
  {
    id: 10,
    category: "Secure Development / CI-CD Pipeline Security",
    question:
      "During a code review, you discover a GitHub Actions workflow that uses `pull_request_target` trigger and runs `npm test` on the PR's head branch code. The workflow has write permissions to the repository. What is the security risk?",
    options: [
      "A) No risk — GitHub Actions are always sandboxed and cannot affect the repository",
      "B) A malicious PR can modify the test scripts to execute arbitrary code with write access to the repository, potentially stealing secrets, modifying releases, or injecting backdoors into the CI/CD pipeline",
      "C) The `pull_request_target` trigger only runs on the base branch code, so it is safe",
      "D) Write permissions are automatically revoked during PR workflows",
    ],
    correctIndex: 1,
    rationale:
      "The `pull_request_target` trigger runs in the context of the base branch but can be tricked into checking out and executing the PR's head code. Combined with write permissions, a malicious fork can craft a PR that modifies test scripts to exfiltrate secrets (GITHUB_TOKEN, deployment keys) or inject malicious code into releases. This is a well-documented GitHub Actions vulnerability. The mitigation is to never run untrusted code with elevated permissions.",
  },
];

// Universal export: works in both browser <script> and Node.js ESM/CJS
if (typeof module !== "undefined" && module.exports) {
  module.exports = { QUESTIONS };
} else if (typeof window !== "undefined") {
  window.QUESTIONS = QUESTIONS;
}
