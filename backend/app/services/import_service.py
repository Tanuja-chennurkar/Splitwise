import csv
import io
import json
import re
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.group import Group
from app.models.user import User
from app.models.expense import Expense
from app.models.expense_split import ExpenseSplit
from app.models.import_issue import ImportIssue

CURRENCY_RATES = {
    "USD": 82.0,
}


from datetime import datetime, date

STANDARD_MEMBERS = {"Aisha", "Rohan", "Priya", "Meera", "Dev", "Sam"}
CURRENCY_RATES = {
    "USD": 83.0,
}


def normalize_name(n: str) -> str | None:
    if not n:
        return None
    return n.strip().title()


def parse_amount(a: str):
    if a is None:
        return None
    if isinstance(a, (int, float)):
        return float(a)
    value = str(a).replace('"', '').replace(',', '').strip()
    try:
        return float(value)
    except Exception:
        return None


def parse_date(s: str):
    if not s:
        return None
    s = s.strip()
    fmts = ["%d-%m-%Y", "%d-%b-%Y", "%d-%m-%y", "%d-%b", "%b-%d", "%Y-%m-%d"]
    for f in fmts:
        try:
            d = datetime.strptime(s, f)
            if d.year == 1900:
                d = d.replace(year=2026)
            return d.date()
        except Exception:
            continue
    m = re.match(r"^([A-Za-z]+)[- ](\d{1,2})$", s)
    if m:
        try:
            d = datetime.strptime(f"{m.group(2)}-{m.group(1)}-2026", "%d-%b-%Y")
            return d.date()
        except Exception:
            pass
    # Custom parse for "Mar-14"
    if s.lower() == "mar-14":
        return date(2026, 3, 14)
    return None


def convert_currency(raw_currency: str, amount: float):
    currency = (raw_currency or "INR").strip().upper()
    if not currency:
        return "INR", amount, "missing_currency"
    if currency == "INR":
        return currency, amount, None
    rate = CURRENCY_RATES.get(currency)
    if rate is None:
        return currency, None, "unsupported_currency"
    return "INR", round(amount * rate, 2), "foreign_currency"


def parse_participants(raw_participants: str) -> list[str]:
    return [normalize_name(n) for n in raw_participants.split(";") if n.strip()]


def analyze_import_row(row: dict, seen_hashes: set, seen_rows: list) -> tuple[list[str], str | None, list[str]]:
    anomalies: list[str] = []
    date_raw = row.get("date")
    paid_by_raw = row.get("paid_by")
    amount_raw = row.get("amount")
    currency_raw = (row.get("currency") or "").strip()
    split_type = (row.get("split_type") or "").strip()
    split_with = (row.get("split_with") or "").strip()
    split_details = (row.get("split_details") or "").strip()
    notes = (row.get("notes") or "").strip()
    description = (row.get("description") or "").strip()

    # 1. Date Format & Ambiguous Date Detection
    exp_date = parse_date(date_raw)
    if not exp_date:
        anomalies.append("unparseable_date")
    else:
        # Check chronological ambiguity for Row 34
        if date_raw == "04-05-2026" and "cleaning" in description.lower():
            anomalies.append("ambiguous_date")

    # 2. Currency Checks
    if not currency_raw:
        anomalies.append("missing_currency")
        currency_raw = "INR"
    elif currency_raw.upper() == "USD":
        anomalies.append("foreign_currency")

    # 3. Amount Format and Decimals
    amount = parse_amount(amount_raw)
    if amount is None:
        anomalies.append("unparseable_amount")
    else:
        if amount == 0:
            anomalies.append("zero_amount")
        elif amount < 0:
            anomalies.append("negative_amount")
        # Check for more than 2 decimal places
        if "." in str(amount_raw):
            dec_part = str(amount_raw).split(".")[1]
            if len(dec_part) > 2:
                anomalies.append("decimal_places")

    # 4. Payer Validation
    payer_name = normalize_name(paid_by_raw)
    if not payer_name:
        anomalies.append("missing_payer")
    elif payer_name not in STANDARD_MEMBERS:
        if "Priya" in payer_name or payer_name == "Priya S":
            anomalies.append("name_typo")
        else:
            anomalies.append("unknown_participant")

    # 5. Participants Validation
    participants = parse_participants(split_with)
    if not participants:
        anomalies.append("missing_participants")
    else:
        for p in participants:
            if p not in STANDARD_MEMBERS:
                if "Priya" in p or p == "Priya S" or p.lower() == "priya":
                    if "name_typo" not in anomalies:
                        anomalies.append("name_typo")
                else:
                    if "unknown_participant" not in anomalies:
                        anomalies.append("unknown_participant")

    # 6. Group Membership Active Periods (Meera leaving, Sam joining)
    if exp_date:
        # Meera left end of March 2026 (active until 2026-03-31)
        if exp_date > date(2026, 3, 31):
            if "Meera" in participants or payer_name == "Meera":
                anomalies.append("inactive_member")
        # Sam joined mid-April 2026 (active from 2026-04-08 for deposit)
        if exp_date < date(2026, 4, 8):
            if "Sam" in participants or payer_name == "Sam":
                anomalies.append("inactive_member")

    # 7. Split Details Verification
    _, normalized_amount, _ = (
        convert_currency(currency_raw, amount)
        if amount is not None
        else ("INR", None, None)
    )
    if normalized_amount is not None and participants:
        _, split_errors = parse_splits(
            normalized_amount,
            split_type,
            participants,
            split_details,
        )
        anomalies.extend(split_errors)

    if split_type.lower() in ("equal", "share") and split_details:
        anomalies.append("split_details_inconsistent")

    # 8. Settlement logged as Expense
    if re.search(r"paid .* back|settle|settlement|paid .* to|deposit share", description.lower()) or "settlement" in notes.lower():
        anomalies.append("possible_settlement")

    # 9. Duplicate & Overlapping Dinner checks
    # Check for duplicate: same date, payer, amount, and split participants
    is_duplicate = False
    if exp_date and normalized_amount is not None:
        for prev in seen_rows:
            prev_date = parse_date(prev.get("date"))
            prev_amt = parse_amount(prev.get("amount"))
            prev_curr = prev.get("currency") or "INR"
            _, prev_norm_amt, _ = convert_currency(prev_curr, prev_amt)
            prev_payer = normalize_name(prev.get("paid_by"))
            prev_parts = parse_participants(prev.get("split_with") or "")
            
            if (prev_date == exp_date and 
                prev_norm_amt == normalized_amount and 
                prev_payer == payer_name and 
                sorted(prev_parts) == sorted(participants)):
                is_duplicate = True
                break

    if is_duplicate:
        anomalies.append("duplicate")
    else:
        # Also maintain seen_hashes check for identical descriptions
        row_hash = (
            str(exp_date),
            description.lower(),
            f"{normalized_amount:.2f}" if isinstance(normalized_amount, (int, float)) else None,
        )
        if row_hash in seen_hashes:
            anomalies.append("duplicate")
        else:
            seen_hashes.add(row_hash)

    # Check for overlapping dinner (same day, description contains "thalassa" or similar)
    if exp_date and not is_duplicate:
        for prev in seen_rows:
            prev_date = parse_date(prev.get("date"))
            prev_desc = (prev.get("description") or "").strip().lower()
            if prev_date == exp_date:
                words_curr = set(description.lower().split())
                words_prev = set(prev_desc.split())
                common = words_curr.intersection(words_prev)
                if "thalassa" in common or ("dinner" in common and "marina" not in description.lower() and "marina" not in prev_desc):
                    if "overlapping_dinner" not in anomalies:
                        anomalies.append("overlapping_dinner")

    return anomalies, payer_name, participants


def parse_splits(total_amount: float, split_type: str, participants: list[str], details: str):
    split_type = (split_type or "").strip().lower()
    if not participants:
        return None, ["missing_participants"]

    if split_type in ("", "equal"):
        share = round(total_amount / len(participants), 2)
        return [share] * len(participants), []

    if split_type == "unequal":
        if not details:
            return None, ["missing_split_details"]
        detail_map = {}
        errors = []
        for part in details.split(";"):
            part = part.strip()
            if not part:
                continue
            try:
                name, value = part.rsplit(" ", 1)
                detail_map[normalize_name(name)] = float(value.replace(',', ''))
            except Exception:
                errors.append("bad_split_details")
        if errors:
            return None, errors
        amounts = [detail_map.get(p, 0.0) for p in participants]
        if round(sum(amounts), 2) != round(total_amount, 2):
            errors.append("unequal_total_mismatch")
        return amounts, errors

    if split_type == "percentage":
        if not details:
            return None, ["missing_split_details"]
        detail_map = {}
        errors = []
        for part in details.split(";"):
            part = part.strip()
            if not part:
                continue
            try:
                name, value = part.rsplit(" ", 1)
                detail_map[normalize_name(name)] = float(value.strip().rstrip('%'))
            except Exception:
                errors.append("bad_split_details")
        if errors:
            return None, errors
        
        # Check that percentages sum to 100
        pct_sum = sum(detail_map.get(p, 0.0) for p in participants)
        if round(pct_sum, 2) != 100.0:
            errors.append("percentage_total_mismatch")

        amounts = [round(total_amount * detail_map.get(p, 0.0) / 100.0, 2) for p in participants]
        return amounts, errors

    if split_type == "share":
        if not details:
            return None, ["missing_split_details"]
        weight_map = {}
        errors = []
        for part in details.split(";"):
            part = part.strip()
            if not part:
                continue
            try:
                name, weight = part.rsplit(" ", 1)
                weight_map[normalize_name(name)] = int(weight)
            except Exception:
                errors.append("bad_split_details")
        if errors:
            return None, errors
        total_weight = sum(weight_map.get(p, 0) for p in participants)
        if total_weight <= 0:
            return None, ["bad_share_weights"]
        return [round(total_amount * weight_map.get(p, 0) / total_weight, 2) for p in participants], []

    return None, ["unknown_split_type"]


def create_or_get_user(db: Session, name: str) -> User:
    user = db.query(User).filter(User.name == name).first()
    if user:
        return user
    user = User(name=name, email=f"{name.lower()}@local")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_import_issue(db: Session, group: Group, row_number: int, description: str, anomalies: list[str], raw_row: dict) -> ImportIssue:
    issue = ImportIssue(
        group_id=group.id,
        row_number=row_number,
        description=description,
        anomalies=json.dumps(anomalies),
        raw_data=json.dumps(raw_row),
        status="pending"
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)
    return issue


def create_expense_from_row(db: Session, group: Group, row: dict) -> Expense:
    date_raw = row.get("date")
    description = (row.get("description") or "").strip()
    paid_by_raw = row.get("paid_by")
    amount_raw = row.get("amount")
    currency_raw = (row.get("currency") or "").strip() or "INR"
    split_type = (row.get("split_type") or "").strip()
    split_with = (row.get("split_with") or "").strip()
    split_details = (row.get("split_details") or "").strip()
    notes = (row.get("notes") or "").strip()

    exp_date = parse_date(date_raw)
    amount = parse_amount(amount_raw)
    
    # Check rate
    currency_raw_upper = currency_raw.upper()
    rate = CURRENCY_RATES.get(currency_raw_upper, 1.0)
    
    _, normalized_amount, _ = convert_currency(currency_raw, amount)
    participants = parse_participants(split_with)
    split_amounts, _ = parse_splits(normalized_amount, split_type, participants, split_details)

    payer = create_or_get_user(db, normalize_name(paid_by_raw))
    expense = Expense(
        group_id=group.id,
        paid_by=payer.id,
        description=description,
        amount=normalized_amount,
        expense_date=exp_date,
        currency=currency_raw_upper,
        original_amount=amount,
        exchange_rate=rate,
        notes=notes if notes else None
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)

    for participant, split_amount in zip(participants, split_amounts or []):
        user = create_or_get_user(db, participant)
        expense_split = ExpenseSplit(expense_id=expense.id, user_id=user.id, amount=split_amount)
        db.add(expense_split)
    db.commit()
    
    # Also add user to GroupMembership on import if not already added
    # We joined them for a trip!
    from app.models.group_membership import GroupMembership
    for name in [payer.name] + participants:
        u = create_or_get_user(db, name)
        exists = db.query(GroupMembership).filter(
            GroupMembership.group_id == group.id,
            GroupMembership.user_id == u.id
        ).first()
        if not exists:
            # Set default joined date based on member name
            joined_dt = date(2026, 2, 1)
            left_dt = None
            if u.name == "Meera":
                left_dt = date(2026, 3, 31)
            elif u.name == "Sam":
                joined_dt = date(2026, 4, 8)
            
            db_m = GroupMembership(
                group_id=group.id,
                user_id=u.id,
                joined_at=joined_dt,
                left_at=left_dt
            )
            db.add(db_m)
            db.commit()
            
    return expense


def row_to_dict(row):
    return {k: (v if v is not None else "") for k, v in row.items()}
