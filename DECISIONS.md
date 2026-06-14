# DECISIONS - Architectural & PM Decisions Log

This document records the key architectural, technical, and product decisions made during the development of the Shared Expenses App, listing options considered and our final choices.

---

## 1. Staged Interactive Import Wizard (vs Automated Parsing)
* **Problem**: The CSV file contains multiple data issues (typos, duplicates, invalid splits). How do we ingest it without failing the import or silently guessing corrections?
* **Options Considered**:
  1. *Automated Rule-Based Guessing*: Create hardcoded algorithms that automatically fix typos (e.g. map `Priya S` to `Priya` silently) and drop duplicates.
  2. *Interactive Import Wizard (Staged Storing)*: Write problematic rows to a temporary database table (`import_issues`). Render a review panel where the user (Meera) can examine each row's issues and click "Approve Resolution" or configure corrections.
* **Chosen Solution**: **Option 2 (Interactive Wizard)**.
* **Rationale**: This fits Meera’s request: *“Clean up the duplicates — but I want to approve anything the app deletes or changes.”* Silent corrections risk corrupting the group's balances without accountability. An interactive wizard gives users full oversight, enabling them to map typos, pick duplicate winners, customize currency rates, and adjust split participants before committing.

---

## 2. Multi-Currency Storage Policy (Priya's Request)
* **Problem**: Part of the Goa trip spending was in USD. How do we convert and audit these foreign currencies?
* **Options Considered**:
  1. *Immediate Conversion (Discard Meta)*: Convert USD to INR during parsing and only store the final INR amount.
  2. *Audit-Trail Conversion (Store Meta)*: Store the final converted `amount` (INR) alongside original metadata: `currency`, `original_amount`, and `exchange_rate` in the `expenses` table.
* **Chosen Solution**: **Option 2 (Store Meta)**.
* **Rationale**: This addresses Priya's request (*“The sheet pretends a dollar is a rupee. That can’t be right”*) and Rohan's request for *“no magic numbers”*. Storing the original currency and rate in the ledger allows users to audit exactly how a $540 villa booking was converted to INR (e.g., $540 @ ₹83.0 = ₹44,820), showing full transparency.

---

## 3. Enforcing Active Membership Periods (Sam & Meera's Requests)
* **Problem**: Group membership changes over time (Meera left end of March; Sam joined mid-April). How do we prevent billing members for expenses dated when they weren't in the group?
* **Options Considered**:
  1. *Global Group splits*: Split every expense equally among all users currently registered in the group, regardless of date.
  2. *Date-Enforced Membership Splits*: Include `joined_at` and `left_at` columns in the `group_memberships` table. Check these dates when performing splits or importing.
* **Chosen Solution**: **Option 2 (Date-Enforced Splits)**.
* **Rationale**: This solves Sam's request (*“I moved in mid-April. Why would March electricity affect my balance?”*) and Meera's request. When an expense date falls outside a user's active membership range, the wizard flags it as an anomaly (`inactive_member`), prompting the user to exclude the member and redistribute the expense share.

---

## 4. Mini-Max Greedy Cash Minimization (Aisha's Request)
* **Problem**: Aisha wants a simplified summary of who pays whom and how much, rather than a web of tiny direct debts.
* **Options Considered**:
  1. *Direct Ledgers*: Leave debts as they are (A owes B, B owes C, C owes A).
  2. *Greedy Debt Simplification (Cash Minimization)*: Calculate the net balance of each user (sum of paid expenses minus sum of split shares plus settlements). Sort debtors and creditors, and greedily match them to generate a minimized direct transfer list.
* **Chosen Solution**: **Option 2 (Greedy Cash Minimization)**.
* **Rationale**: This directly answers Aisha’s request (*“I just want one number per person. Who pays whom, how much, done.”*). Instead of four flatmates making 12 separate bank transfers, the algorithm simplifies the cash flow to the absolute minimum transfers needed to bring everyone's balance to zero.

---

## 5. Settlement Sign Correction (Bug Fix)
* **Problem**: The original database settlement logic double-billed debtors when recording a payment instead of settling.
* **Options Considered**:
  1. *Deduct from payer, add to payee* (Original): Decreased payer's balance (making them more in debt) and increased payee's balance.
  2. *Add to payer, deduct from payee* (Corrected): Since a debtor's balance is negative (e.g., -2300), paying a settlement of 2300 should increase their balance back to 0. Since a creditor's balance is positive, receiving a settlement should decrease their balance back to 0.
* **Chosen Solution**: **Option 2 (Add to payer, deduct from payee)**.
* **Rationale**: This mathematically cancels out the outstanding debts upon logging a settlement.
