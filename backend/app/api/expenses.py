from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.models.expense import Expense
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseResponse
)
from app.models.expense_split import ExpenseSplit
from app.models.user import User
from app.models.group import Group

import csv
import io
from datetime import datetime
import re

router = APIRouter(
    prefix="/expenses",
    tags=["Expenses"]
)


@router.post("/", response_model=ExpenseResponse)
def create_expense(
    expense: ExpenseCreate,
    db: Session = Depends(get_db)
):
    db_expense = Expense(
        group_id=expense.group_id,
        paid_by=expense.paid_by,
        description=expense.description,
        amount=expense.amount,
        expense_date=expense.expense_date
    )

    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)

    return db_expense


@router.get("/", response_model=list[ExpenseResponse])
def get_expenses(
    db: Session = Depends(get_db)
):
    return db.query(Expense).all()


@router.get("/{expense_id}", response_model=ExpenseResponse)
def get_expense(
    expense_id: int,
    db: Session = Depends(get_db)
):
    return (
        db.query(Expense)
        .filter(Expense.id == expense_id)
        .first()
    )
    
@router.delete("/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db)
):
    db.query(ExpenseSplit).filter(
        ExpenseSplit.expense_id == expense_id
    ).delete()

    db.query(Expense).filter(
        Expense.id == expense_id
    ).delete()

    db.commit()

    return {"message": "Expense deleted"}


@router.post("/import-csv")
def import_expenses(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    content = file.file.read().decode(errors="replace")
    reader = csv.DictReader(io.StringIO(content))

    # ensure group exists
    group = db.query(Group).filter(Group.name == "Flatmates").first()
    if not group:
        group = Group(name="Flatmates", description="Imported flatmates group")
        db.add(group)
        db.commit()
        db.refresh(group)

    report = []
    created = 0

    def normalize_name(n: str) -> str | None:
        if not n:
            return None
        return n.strip().title()

    def parse_amount(a: str):
        if a is None:
            return None
        a = a.replace(',', '').strip()
        try:
            return float(a)
        except Exception:
            return None

    def parse_date(s: str):
        if not s:
            return None
        s = s.strip()
        # try a few formats
        fmts = ["%d-%m-%Y", "%d-%b-%Y", "%d-%m-%y", "%d-%b", "%b-%d", "%Y-%m-%d"]
        for f in fmts:
            try:
                d = datetime.strptime(s, f)
                # if year missing, assume 2026
                if d.year == 1900:
                    d = d.replace(year=2026)
                return d.date()
            except Exception:
                continue
        # try parsing like Mar-14
        m = re.match(r"([A-Za-z]+)[- ](\d{1,2})", s)
        if m:
            try:
                d = datetime.strptime(f"{m.group(2)}-{m.group(1)}-2026", "%d-%b-%Y")
                return d.date()
            except Exception:
                pass
        return None

    rows = list(reader)
    seen_hashes = set()

    for idx, row in enumerate(rows, start=1):
        anomalies = []

        date_raw = row.get("date")
        description = (row.get("description") or "").strip()
        paid_by_raw = row.get("paid_by")
        amount_raw = row.get("amount")
        currency = (row.get("currency") or "INR").strip()
        split_type = (row.get("split_type") or "").strip()
        split_with = (row.get("split_with") or "").strip()
        split_details = (row.get("split_details") or "").strip()
        notes = (row.get("notes") or "").strip()

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

        paid_by = normalize_name(paid_by_raw)
        if not paid_by:
            anomalies.append("missing_payer")

        # simple duplicate detection by normalized triple
        amount_key = f"{amount:.2f}" if isinstance(amount, (int, float)) else None
        row_hash = (str(exp_date), description.lower(), amount_key)
        if row_hash in seen_hashes:
            anomalies.append("duplicate")
        else:
            seen_hashes.add(row_hash)

        # settlement detection heuristics
        if re.search(r"paid .* back|settle|settlement|paid .* to", description.lower()) or "settlement" in notes.lower():
            anomalies.append("possible_settlement")

        # currency missing or USD present
        if not currency:
            anomalies.append("missing_currency")
        if currency.upper() != "INR":
            anomalies.append("foreign_currency")

        # split vs details mismatch
        if split_type.lower() in ("equal", "share") and split_details:
            anomalies.append("split_details_inconsistent")

        # map or create users mentioned
        participants = [normalize_name(n) for n in split_with.split(";") if n.strip()]
        unknown_users = [p for p in participants if p and not db.query(User).filter(User.name == p).first()]
        for u in unknown_users:
            # create user record without email
            new_user = User(name=u, email=f"{u.lower()}@local")
            db.add(new_user)
        if unknown_users:
            db.commit()

        # if any anomalies flagged, do not auto-create expense; include in report for review
        if anomalies:
            report.append({"row": idx, "description": description, "anomalies": anomalies, "raw": row})
            continue

        # create or find payer
        payer_name = normalize_name(paid_by_raw)
        payer = db.query(User).filter(User.name == payer_name).first()
        if not payer:
            payer = User(name=payer_name, email=f"{payer_name.lower()}@local")
            db.add(payer)
            db.commit()
            db.refresh(payer)

        # create expense
        db_expense = Expense(
            group_id=group.id,
            paid_by=payer.id,
            description=description,
            amount=amount,
            expense_date=exp_date
        )
        db.add(db_expense)
        db.commit()
        db.refresh(db_expense)

        # create equal splits
        per_user = round(amount / max(1, len(participants)), 2)
        for p in participants:
            user = db.query(User).filter(User.name == p).first()
            if user:
                split = ExpenseSplit(expense_id=db_expense.id, user_id=user.id, amount=per_user)
                db.add(split)
        db.commit()
        created += 1

    return {"created": created, "anomalies": report}