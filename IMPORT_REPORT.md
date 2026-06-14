# CSV Import Anomaly & Resolution Report

This report lists every row from `Expenses Export.csv`, the anomalies detected by the application parser, and the actions taken or proposed to resolve them.

| Row | Date | Description | Paid By | Amount | Detected Anomalies | Action Taken / Resolution Policy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | 01-02-2026 | February rent | Aisha | 48000 INR | None (Clean) | Imported successfully. |
| 2 | 03-02-2026 | Groceries BigBasket | Priya | 2340 INR | None (Clean) | Imported successfully. |
| 3 | 05-02-2026 | Wifi bill Feb | Rohan | 1199 INR | None (Clean) | Imported successfully. |
| 4 | 08-02-2026 | Dinner at Marina Bites | Dev | 3200 INR | None (Clean) | Imported successfully. |
| 5 | 08-02-2026 | dinner - marina bites | Dev | 3200 INR | `duplicate` | Ignore/Discard the duplicate row. |
| 6 | 10-02-2026 | Electricity Feb | Aisha | 1,200 INR | None (Clean) | Imported successfully. |
| 7 | 12-02-2026 | Maid salary Feb | Meera | 3000 INR | None (Clean) | Imported successfully. |
| 8 | 14-02-2026 | Movie night snacks | priya | 640 INR | None (Clean) | Imported successfully. |
| 9 | 15-02-2026 | Cylinder refill | Rohan | 899.995 INR | `decimal_places` | Round mathematically to 2 decimal places (899.995 -> 900.00). |
| 10 | 18-02-2026 | Groceries DMart | Priya S | 1875 INR | `name_typo` | Normalize spelling/casing (e.g., Priya S -> Priya, priya -> Priya, rohan -> Rohan). |
| 11 | 20-02-2026 | Aisha birthday cake | Rohan | 1500 INR | None (Clean) | Imported successfully. |
| 12 | 22-02-2026 | House cleaning supplies |  | 780 INR | `missing_payer` | Assign missing payer to Rohan (confirmed group admin/payer). |
| 13 | 25-02-2026 | Rohan paid Aisha back | Rohan | 5000 INR | `possible_settlement` | Process as direct Payment (settlement) to cancel debt, rather than an expense. |
| 14 | 28-02-2026 | Pizza Friday | Aisha | 1440 INR | `percentage_total_mismatch` | Scale splits proportionally to 100% or adjust manually. |
| 15 | 01-03-2026 | March rent | Aisha | 48000 INR | None (Clean) | Imported successfully. |
| 16 | 03-03-2026 | Groceries BigBasket | Meera | 2810 INR | None (Clean) | Imported successfully. |
| 17 | 05-03-2026 | Wifi bill Mar | Rohan | 1199 INR | None (Clean) | Imported successfully. |
| 18 | 08-03-2026 | Goa flights | Aisha | 32400 INR | None (Clean) | Imported successfully. |
| 19 | 09-03-2026 | Goa villa booking | Dev | 540 USD | `foreign_currency` | Convert USD to INR at standard exchange rate (83.0) and store original metadata. |
| 20 | 10-03-2026 | Beach shack lunch | Rohan | 84 USD | `foreign_currency` | Convert USD to INR at standard exchange rate (83.0) and store original metadata. |
| 21 | 10-03-2026 | Scooter rentals | Priya | 3600 INR | `split_details_inconsistent` | Import split weights/shares directly from split details. |
| 22 | 11-03-2026 | Parasailing | Dev | 150 USD | `foreign_currency`, `unknown_participant` | Convert USD to INR at standard exchange rate (83.0) and store original metadata. Assign guest Kabir's share to his inviter Dev. |
| 23 | 11-03-2026 | Dinner at Thalassa | Aisha | 2400 INR | None (Clean) | Imported successfully. |
| 24 | 11-03-2026 | Thalassa dinner | Rohan | 2450 INR | `overlapping_dinner` | Surfaced for review. Keep correct row (Rohan's Thalassa dinner for ₹2,450) and ignore duplicate (Aisha's Thalassa dinner for ₹2,400). |
| 25 | 12-03-2026 | Parasailing refund | Dev | -30 USD | `foreign_currency`, `negative_amount` | Convert USD to INR at standard exchange rate (83.0) and store original metadata. Process as negative split refund, reducing net balances. |
| 26 | Mar-14 | Airport cab | rohan  | 1100 INR | None (Clean) | Imported successfully. |
| 27 | 15-03-2026 | Groceries DMart | Priya | 2105 INR | `missing_currency` | Default to group's primary currency (INR). |
| 28 | 18-03-2026 | Electricity Mar | Aisha | 1450 INR | None (Clean) | Imported successfully. |
| 29 | 20-03-2026 | Maid salary Mar | Meera | 3000 INR | None (Clean) | Imported successfully. |
| 30 | 22-03-2026 | Dinner order Swiggy | Priya | 0 INR | `zero_amount` | Marked for review; user enters correct amount or ignores. |
| 31 | 25-03-2026 | Weekend brunch | Meera | 2200 INR | `percentage_total_mismatch` | Scale splits proportionally to 100% or adjust manually. |
| 32 | 28-03-2026 | Meera farewell dinner | Aisha | 4800 INR | None (Clean) | Imported successfully. |
| 33 | 04-05-2026 | Deep cleaning service | Rohan | 2500 INR | `ambiguous_date` | Review & resolve `ambiguous_date` manually. |
| 34 | 01-04-2026 | April rent | Aisha | 48000 INR | `split_details_inconsistent` | Import split weights/shares directly from split details. |
| 35 | 02-04-2026 | Groceries BigBasket | Priya | 2640 INR | `inactive_member` | Remove Meera (inactive after Mar 31) or Sam (inactive before Apr 8) from active splits. |
| 36 | 05-04-2026 | Wifi bill Apr | Rohan | 1199 INR | None (Clean) | Imported successfully. |
| 37 | 08-04-2026 | Sam deposit share | Sam | 15000 INR | `possible_settlement` | Process as direct Payment (settlement) to cancel debt, rather than an expense. |
| 38 | 10-04-2026 | Housewarming drinks | Sam | 3100 INR | None (Clean) | Imported successfully. |
| 39 | 12-04-2026 | Electricity Apr | Aisha | 1380 INR | None (Clean) | Imported successfully. |
| 40 | 15-04-2026 | Groceries DMart | Sam | 1990 INR | None (Clean) | Imported successfully. |
| 41 | 18-04-2026 | Furniture for common room | Aisha | 12000 INR | `split_details_inconsistent` | Import split weights/shares directly from split details. |
| 42 | 20-04-2026 | Maid salary Apr | Priya | 3000 INR | None (Clean) | Imported successfully. |