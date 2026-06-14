# AI USAGE - AI Collaboration Log

This document records the AI tools, key prompt strategies, and three specific logic errors identified and resolved during pair-programming.

---

## AI Collaboration & Prompts

* **AI Tool**: Antigravity (powered by Gemini 3.5 Flash)
* **Key Prompts Used**:
  - *Codebase Research*: "Inspect workspace directory and read backend main.py to understand starting stack."
  - *Database Verification*: "Run python script using inspect to list tables in spiltwise_db."
  - *Interactive Wizard Architecture*: "Define CSV import resolution policies for 12+ anomalies; update import_service.py validation rules."
  - *CSS Theme*: "Design a premium dark-mode glassmorphic theme in index.css using Outfit typography."

---

## Error Correction Case Studies

### 1. Settlement Sign Bug in Balance Calculation
* **What went wrong**: The starter code in `backend/app/api/groups.py` deducted settlement amounts from the payer's balance and added them to the payee's balance:
  ```python
  balances[p.payer_id]["balance"] -= p.amount
  balances[p.payee_id]["balance"] += p.amount
  ```
  Since debtors have negative balances (e.g. B owes ₹50, so balance = -50), deducting ₹50 made B's balance -100 (doubling debt).
* **How it was caught**: Hand-calculating the net effect of a ₹50 transfer from B to A. We observed that instead of bringing both balances to 0, it increased the gap to A (+100) and B (-100).
* **What we changed**: Modified the sign calculation so settlements correctly cancel debts:
  ```python
  balances[p.payer_id]["balance"] += p.amount
  balances[p.payee_id]["balance"] -= p.amount
  ```

---

### 2. Missing Database Tables Startup Bug
* **What went wrong**: The `payments` table was not being created in PostgreSQL on server boot.
* **How it was caught**: Running a python inspect check (`print(inspect(engine).get_table_names())`) and noting that `payments` was absent. This happened because the model `Payment` was never imported inside `main.py` before `Base.metadata.create_all(bind=engine)` was called.
* **What we changed**: Added explicit model imports for `Payment` and `ExpenseSplit` in `main.py` and refactored `app/db/base.py` to keep it clean, eliminating circular dependency loops.

---

### 3. Split Detail Inputs Parser Crash
* **What went wrong**: The original backend percentage splitter (`compute_splits`) split the string details by semicolon and called `float(p)` directly. However, the frontend form maps splits as `user_id:value` (e.g. `1:30;2:30`). This caused a `ValueError` crash inside the backend when resolving percentage or share types.
* **How it was caught**: Cross-referencing the frontend payload creation (`selectedMembers.map(m => `${m}:${splitValues[m]}`).join(";")`) against the backend's split parser.
* **What we changed**: Replaced the splitting logic with a robust parser `calculate_split_amounts` which parses key-value pairs separated by either space (from CSV) or colon (from frontend) and extracts the values correctly.
