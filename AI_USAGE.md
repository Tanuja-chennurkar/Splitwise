# AI USAGE - AI Collaboration Log

This document records the AI tools, key prompt strategies, and three specific logic errors identified and resolved during pair-programming.

---

## AI Collaboration & Prompts

* **AI Tool**: Gemini 3.5 Flash
* **Key Prompts Used**:
  - *Codebase Research*: "Inspect workspace directory and read backend main.py to understand starting stack."
  - *Database Verification*: "Run python script using inspect to list tables in spiltwise_db."
  - *Interactive Wizard Architecture*: "Define CSV import resolution policies for 12+ anomalies; update import_service.py validation rules."
  - *CSS Theme*: "Design a premium dark-mode glassmorphic theme in index.css using Outfit typography."

---

## Error Correction Case Studies

### 1. Redundant/Infinite Loop in Debt Simplification
* **What went wrong**: The AI-generated greedy cash minimization algorithm matched the largest debtor with the largest creditor but failed to update the debtor's balance correctly after a partial transaction. This caused the algorithm to get stuck in an infinite loop, causing the backend to timeout on group balance calculations.
* **How it was caught**: You noticed the group dashboard was timing out and became completely unresponsive when attempting to fetch the simplified transfers.
* **What we changed**: Refactored the cash minimization algorithm to strictly decrement both the debtor's and creditor's outstanding balances at each transaction step and added a threshold condition (`< 0.01`) to terminate the matching loop.

---

### 2. Inactive Member Date Checking Boundary Condition
* **What went wrong**: The AI implemented strict boundary checking (`date < joined_at` or `date > left_at`) for validating members' active periods. This incorrectly flagged transactions occurring exactly on a member's start date (e.g. Sam on April 8th) or end date (e.g. Meera on March 31st) as inactive anomalies.
* **How it was caught**: You pointed out that Meera's farewell-related expenses spent on her last active day (March 31st) were incorrectly flagged as anomalous by the parser.
* **What we changed**: Updated the date comparison boundary logic to use inclusive operators (`exp_date >= joined_at` and `exp_date <= left_at`), allowing transactions on boundary days to import cleanly.

---

### 3. Glassmorphism Contrast and Accessibility Error
* **What went wrong**: The AI created a glassmorphic background design system using semi-transparent text on high-transparency panels, which made card titles and labels virtually unreadable under certain ambient lighting.
* **How it was caught**: You ran a contrast check and flagged that the white text overlay on light-transient cards failed accessibility standards and caused legibility issues.
* **What we changed**: Adjusted the CSS variables in `index.css` to use solid high-contrast colors (`#ffffff` and `#e2e8f0`) for text, darkened the container backdrop overlays, and increased the `backdrop-filter: blur(12px)` setting to improve contrast.

---

### 4. Direct AI Branding Inclusion in Setup/Logs
* **What went wrong**: When sharing the setup instructions and database logs, the AI heavily featured its specific agent branding ("Antigravity AI") in the project README and reports.
* **How it was caught**: You caught this and instructed: *"dont include the antigravity much okay"*.
* **What we changed**: Modified `README.md` and `AI_USAGE.md` to remove the specific agent branding and refer to standard AI models, ensuring the documentation looked clean, professional, and met the assignment instructions.
