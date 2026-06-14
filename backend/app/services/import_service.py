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


def normalize_name(n: str) -> str | None:
    if not n:
        return None
    return n.strip().title()


def parse_amount(a: str):
    if a is None:
        return None
    value = a.replace(',', '').strip()
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


def analyze_import_row(row: dict, seen_hashes: set) -> tuple[list[str], str | None, list[str]]:
    anomalies: list[str] = []
    date_raw = row.get("date")
    paid_by_raw = row.get("paid_by")
    amount_raw = row.get("amount")
    currency_raw = (row.get("currency") or "INR").strip()
    split_type = (row.get("split_type") or "").strip()
    split_with = (row.get("split_with") or "").strip()
    split_details = (row.get("split_details") or "").strip()
    notes = (row.get("notes") or "").strip()
    description = (row.get("description") or "").strip()

    exp_date = parse_date(date_raw)
    if not exp_date:
        anomalies.append("unparseable_date")

    amount = parse_amount(amount_raw)
    if amount is None:
        anomalies.append("unparseable_amount")
    else:
        if amount == 0:
            anomalies.append("zero_amount")
        if amount < 0:
            anomalies.append("negative_amount")

    payer_name = normalize_name(paid_by_raw)
    if not payer_name:
        anomalies.append("missing_payer")

    participants = parse_participants(split_with)
    if not participants:
        anomalies.append("missing_participants")

    _, normalized_amount, currency_issue = (
        convert_currency(currency_raw, amount)
        if amount is not None
        else ("INR", None, None)
    )
    if currency_issue:
        anomalies.append(currency_issue)

    if normalized_amount is not None:
        _, split_errors = parse_splits(
            normalized_amount,
            split_type,
            participants,
            split_details,
        )
        anomalies.extend(split_errors)

    if split_type.lower() in ("equal", "share") and split_details:
        anomalies.append("split_details_inconsistent")

    if re.search(r"paid .* back|settle|settlement|paid .* to", description.lower()) or "settlement" in notes.lower():
        anomalies.append("possible_settlement")

    row_hash = (
        str(exp_date),
        description.lower(),
        f"{normalized_amount:.2f}" if isinstance(normalized_amount, (int, float)) else None,
    )
    if row_hash in seen_hashes:
        anomalies.append("duplicate")
    else:
        seen_hashes.add(row_hash)

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
    currency_raw = (row.get("currency") or "INR").strip()
    split_type = (row.get("split_type") or "").strip()
    split_with = (row.get("split_with") or "").strip()
    split_details = (row.get("split_details") or "").strip()

    exp_date = parse_date(date_raw)
    amount = parse_amount(amount_raw)
    _, normalized_amount, _ = convert_currency(currency_raw, amount)
    participants = parse_participants(split_with)
    split_amounts, _ = parse_splits(normalized_amount, split_type, participants, split_details)

    payer = create_or_get_user(db, normalize_name(paid_by_raw))
    expense = Expense(
        group_id=group.id,
        paid_by=payer.id,
        description=description,
        amount=normalized_amount,
        expense_date=exp_date
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)

    for participant, split_amount in zip(participants, split_amounts or []):
        user = create_or_get_user(db, participant)
        expense_split = ExpenseSplit(expense_id=expense.id, user_id=user.id, amount=split_amount)
        db.add(expense_split)
    db.commit()
    return expense


def row_to_dict(row):
    return {k: (v if v is not None else "") for k, v in row.items()}
