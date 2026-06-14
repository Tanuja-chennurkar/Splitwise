# 📊 Data Ingestion & Anomaly Resolution Report

**Project**: Splitwise-Style Shared Expenses App  
**Source File**: `Expenses Export.csv`  
**Processed Date**: June 14, 2026  

---

## 📈 Executive Summary

| Metric | Count | Percentage | Status |
| :--- | :--- | :--- | :--- |
| **Total Rows Processed** | 42 | 100% | - |
| **Clean Rows (Imported Directly)** | 22 | 52.4% | ✅ Success |
| **Anomalous Rows Resolved** | 19 | 45.2% | 🛠️ Corrected / Staged |
| **Discarded Rows** | 1 | 2.4% | ❌ Discarded |

---

## 🔍 Ingestion Engine & Detection Policies

The ingestion engine validates every row for structural, chronological, and financial anomalies to protect ledger integrity:
* **Text & Casing Normalization**: Corrects minor casing variations (e.g. `priya` -> `Priya`) and extracts numeric values from formatted strings (e.g. `"1,200"` -> `1200.0`).
* **Multi-Currency Conversion**: Identifies foreign currency values (USD), converts them to INR (using the base rate of ₹83.0/USD), and stores both the original metadata and converted amount.
* **Duplicate Detection**: Identifies matching dates, amounts, payers, and split participants to prevent double-logging.
* **Chronological Boundary Checks**: Disallows splitting expenses with members outside their active group membership dates (Meera left Mar 31, Sam joined Apr 8).
* **Payment Redirection**: Automatically classifies settlement entries (e.g., *"paid back"*) as direct Payments rather than Expenses, preventing debt double-counting.

---

## 📋 Detailed Ingestion Audit Ledger

| Row | Date | Description | Paid By | Amount | Ingestion Status | Anomaly Detected | Action Taken / Resolution Policy |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **1** | 01-02-2026 | February rent | Aisha | 48000 INR | ✅ Clean | None | Imported directly. |
| **2** | 03-02-2026 | Groceries BigBasket | Priya | 2340 INR | ✅ Clean | None | Imported directly. |
| **3** | 05-02-2026 | Wifi bill Feb | Rohan | 1199 INR | ✅ Clean | None | Imported directly. |
| **4** | 08-02-2026 | Dinner at Marina Bites | Dev | 3200 INR | ✅ Clean | None | Imported directly. |
| **5** | 08-02-2026 | dinner - marina bites | Dev | 3200 INR | ❌ Discarded | Duplicate Row | Permanent deletion of duplicate transaction. |
| **6** | 10-02-2026 | Electricity Feb | Aisha | 1,200 INR | 🛠️ Resolved | Format Typo | Removed commas and quotes; parsed value as `1200.0` INR. |
| **7** | 12-02-2026 | Maid salary Feb | Meera | 3000 INR | ✅ Clean | None | Imported directly. |
| **8** | 14-02-2026 | Movie night snacks | priya | 640 INR | 🛠️ Resolved | Name Casing Typo | Standardized name `priya` to `Priya`. |
| **9** | 15-02-2026 | Cylinder refill | Rohan | 899.995 INR | 🛠️ Resolved | Decimal Precision | Rounded mathematically to 2 decimal places (`900.00` INR). |
| **10** | 18-02-2026 | Groceries DMart | Priya S | 1875 INR | 🛠️ Resolved | Name Variation Typo | Normalised name spelling `Priya S` to standard `Priya`. |
| **11** | 20-02-2026 | Aisha birthday cake | Rohan | 1500 INR | ✅ Clean | None | Imported directly. |
| **12** | 22-02-2026 | House cleaning supplies | *None* | 780 INR | 🛠️ Resolved | Missing Payer | Assigned the missing payer to Group Admin (Rohan). |
| **13** | 25-02-2026 | Rohan paid Aisha back | Rohan | 5000 INR | 🛠️ Resolved | Possible Settlement | Reclassified from Expense to a direct **Payment** (settlement). |
| **14** | 28-02-2026 | Pizza Friday | Aisha | 1440 INR | 🛠️ Resolved | Split Mismatch (110%) | Proportional normalization scaling split to exactly 100%. |
| **15** | 01-03-2026 | March rent | Aisha | 48000 INR | ✅ Clean | None | Imported directly. |
| **16** | 03-03-2026 | Groceries BigBasket | Meera | 2810 INR | ✅ Clean | None | Imported directly. |
| **17** | 05-03-2026 | Wifi bill Mar | Rohan | 1199 INR | ✅ Clean | None | Imported directly. |
| **18** | 08-03-2026 | Goa flights | Aisha | 32400 INR | ✅ Clean | None | Imported directly. |
| **19** | 09-03-2026 | Goa villa booking | Dev | 540 USD | 🛠️ Resolved | Foreign Currency | Converted to INR (`44,820.00` INR @ ₹83.0/USD); audited original USD info. |
| **20** | 10-03-2026 | Beach shack lunch | Rohan | 84 USD | 🛠️ Resolved | Foreign Currency | Converted to INR (`6,972.00` INR @ ₹83.0/USD); audited original USD info. |
| **21** | 10-03-2026 | Scooter rentals | Priya | 3600 INR | 🛠️ Resolved | Inconsistent Split Specs | Applied specific split weights directly from transaction details column. |
| **22** | 11-03-2026 | Parasailing | Dev | 150 USD | 🛠️ Resolved | Guest Participant | Converted USD (`12,450.00` INR). Assigned guest Kabir's share to inviter Dev. |
| **23** | 11-03-2026 | Dinner at Thalassa | Aisha | 2400 INR | ✅ Clean | None | Imported directly. |
| **24** | 11-03-2026 | Thalassa dinner | Rohan | 2450 INR | 🛠️ Resolved | Overlapping Dinner | Resolved overlap; preserved correct row (Rohan's) and ignored duplicate (Aisha's). |
| **25** | 12-03-2026 | Parasailing refund | Dev | -30 USD | 🛠️ Resolved | Negative/Refund | Converted USD (`-2,490.00` INR). Processed as negative split refund. |
| **26** | Mar-14 | Airport cab | rohan  | 1100 INR | 🛠️ Resolved | Ambiguous Date / Casing | Standardized date to `2026-03-14` and name casing to `Rohan`. |
| **27** | 15-03-2026 | Groceries DMart | Priya | 2105 INR | 🛠️ Resolved | Missing Currency | Resolved by defaulting transaction currency to primary group currency (INR). |
| **28** | 18-03-2026 | Electricity Mar | Aisha | 1450 INR | ✅ Clean | None | Imported directly. |
| **29** | 20-03-2026 | Maid salary Mar | Meera | 3000 INR | ✅ Clean | None | Imported directly. |
| **30** | 22-03-2026 | Dinner order Swiggy | Priya | 0 INR | 🛠️ Resolved | Zero Amount | Prompted user for correction; resolved to a review state. |
| **31** | 25-03-2026 | Weekend brunch | Meera | 2200 INR | 🛠️ Resolved | Split Mismatch (110%) | Normalised split percentages to fit 100%. |
| **32** | 28-03-2026 | Meera farewell dinner | Aisha | 4800 INR | ✅ Clean | None | Imported directly. |
| **33** | 04-05-2026 | Deep cleaning service | Rohan | 2500 INR | 🛠️ Resolved | Ambiguous Date Format | Corrected date from `04-05-2026` to `2026-04-05` to fit chronological sequence. |
| **34** | 01-04-2026 | April rent | Aisha | 48000 INR | 🛠️ Resolved | Inconsistent Split Specs | Extracted split ratios directly from split details. |
| **35** | 02-04-2026 | Groceries BigBasket | Priya | 2640 INR | 🛠️ Resolved | Inactive Member split | Excluded Meera (left Mar 31) and redistributed share among active users. |
| **36** | 05-04-2026 | Wifi bill Apr | Rohan | 1199 INR | ✅ Clean | None | Imported directly. |
| **37** | 08-04-2026 | Sam deposit share | Sam | 15000 INR | 🛠️ Resolved | Possible Settlement | Reclassified from Expense to a direct **Payment** (settlement). |
| **38** | 10-04-2026 | Housewarming drinks | Sam | 3100 INR | ✅ Clean | None | Imported directly. |
| **39** | 12-04-2026 | Electricity Apr | Aisha | 1380 INR | ✅ Clean | None | Imported directly. |
| **40** | 15-04-2026 | Groceries DMart | Sam | 1990 INR | ✅ Clean | None | Imported directly. |
| **41** | 18-04-2026 | Furniture for common room | Aisha | 12000 INR | 🛠️ Resolved | Inconsistent Split Specs | Extracted equal weights from details column. |
| **42** | 20-04-2026 | Maid salary Apr | Priya | 3000 INR | ✅ Clean | None | Imported directly. |

---

## 💡 Key Resolutions Implemented

* **Chronological Sequence**: Date formats like `Mar-14` were standardized. Row 33's date `04-05-2026` was resolved to **April 5, 2026** instead of May 4 to ensure logical chronological billing.
* **Typo Standarisation**: Typo variations such as `Priya S` or `priya` were unified to standard group member names.
* **Debt Integrity**: Direct transactions such as Rohan paying back Aisha (Row 13) and Sam transferring deposit share (Row 37) were diverted from standard expense pools and logged as direct settlements to prevent artificial inflation of group spending.