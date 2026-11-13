# 🎥 Scout — 3 to 5 Minute Demo Video Walkthrough Script

Use this structured script to record your 3–5 minute Loom or screen recording for the GenAI Fund hiring team.

---

## ⏱️ Video Structure (Total: ~3:45)

| Section | Time | What to Show on Screen | What to Say |
|---|---|---|---|
| **1. Hook & Problem Framing** | 0:00 - 0:30 | Terminal showing `npm run dev` and browser opening `http://localhost:3000` | "Hi GenAI Fund team, this is Scout. When reaching out to technical AI and robotics founders in Southeast Asia, the two biggest risks are double-messaging someone and sending generic, hallucinated AI spam. I built Scout to solve both with strict engineering guarantees." |
| **2. Target Segment & Discovery** | 0:30 - 1:15 | Screen ① (Campaigns) → Click into *SEA AI & Robotics Builders 2026* → Screen ② (Discovery & Scoring) | "Here is our campaign targeting SEA builders in Embodied AI, Robotics, and LLM Infra. In Sandbox mode, we load 30 realistic profiles across Singapore, Vietnam, Indonesia, Thailand, Malaysia, and the Philippines. Clicking 'Discover' pulls in profiles. Notice how each profile shows raw tweets, follower counts, and location." |
| **3. Evidence-Based Scoring & Drafting** | 1:15 - 2:00 | Click 'Score All' (or show existing scored profiles) → Click an expanded profile card | "When we score candidates, Scout doesn't just output a number. It provides concise bullet points and explicitly cites verbatim evidence from their bio or tweets. When we draft DMs, our post-generation guardrail verifies that the draft quotes real evidence, stays under 280 characters, and eliminates salesy cliches like 'pick your brain'." |
| **4. Human-in-the-Loop Review Queue** | 2:00 - 2:45 | Screen ③ (Review & Approval) → Show split-pane → Edit a message live → Click 'Approve' | "Here's the Review & Approval queue. As an operator, I see the founder's bio and tweets on the left, and the drafted message on the right. I can edit this inline—say, adding a personal note—and hit 'Approve'. Nothing ever leaves the account without human sign-off." |
| **5. Safe Sending & Anti-Duplicate Proof** | 2:45 - 3:15 | Click 'Send Approved DMs' → Click it again immediately → Show Screen ④ (Outreach Tracker) | "Now for the critical invariant: Zero Double-Messaging. When I click 'Send', the system uses atomic locks in SQLite to transition from APPROVED to SENDING to SENT. If I click Send again immediately, it returns 0 rows. Even if someone runs duplicate discovery, our database unique constraint ensures an X user can physically never be contacted twice." |
| **6. Tracking, Settings & Wrap-up** | 3:15 - 3:45 | Screen ④ (Tracker with sent/replied stats) → Settings tab (show BYOK options and Live mode toggle) | "In the Outreach Tracker, we track sent messages, simulated replies, and blocked actions like closed DMs. In Settings, evaluators can plug in their own X API v2 credentials and switch to Live mode, which uses official endpoints with built-in token-bucket rate limiting. Everything runs locally in under 2 minutes. Thank you!" |

---

## 💡 Quick Tips for Recording:
1. **Screen Resolution:** Record at 1080p (1920x1080) with browser zoom at 100% or 110% for crisp readability.
2. **Audio:** Use a clean microphone or headset.
3. **Pacing:** Keep mouse movements deliberate. Don't rush; the UI already speaks for itself.
