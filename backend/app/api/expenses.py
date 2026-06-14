from typing import Annotated

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.models.expense import Expense
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseResponse
)
from app.models.expense_split import ExpenseSplit
from app.models.group import Group
from app.services.import_service import (
    create_or_get_user,
    create_import_issue,
    create_expense_from_row,
    row_to_dict,
    analyze_import_row,
)

import csv
import io

router = APIRouter(
    prefix="/expenses",
    tags=["Expenses"]
)


def compute_splits(total: float, split_type: str | None, participants: list[int], details: str | None):
    if not participants:
        return []
    st = (split_type or "").strip().lower()

    def _equal():
        share = round(total / len(participants), 2)
        return [share] * len(participants)

    def _unequal():
        if not details:
            return [0] * len(participants)
        parts = [p.strip() for p in details.split(";") if p.strip()]
        mapping = {}
        values = []
        for part in parts:
            if ":" in part or " " in part:
                sep = ":" if ":" in part else " "
                left, right = part.rsplit(sep, 1)
                try:
                    key = int(left)
                    val = float(right.replace(',', ''))
                    mapping[key] = val
                except Exception:
                    try:
                        values.append(float(part.replace(',', '')))
                    except Exception:
                        continue
            else:
                try:
                    values.append(float(part.replace(',', '')))
                except Exception:
                    continue
        if mapping:
            return [round(mapping.get(pid, 0.0), 2) for pid in participants]
        if values and len(values) == len(participants):
            return [round(v, 2) for v in values]
        return [0] * len(participants)

    def _percentage():
        if not details:
            return [0] * len(participants)
        parts = [p.strip().rstrip('%') for p in details.split(";") if p.strip()]
        try:
            nums = [float(p) for p in parts]
            return [round(total * (n / 100.0), 2) for n in nums]
        except Exception:
            return [0] * len(participants)

    def _share():
        if not details:
            return [0] * len(participants)
        parts = [p.strip() for p in details.split(";") if p.strip()]
        weights = []
        mapping = {}
        for part in parts:
            if ":" in part or " " in part:
                sep = ":" if ":" in part else " "
                left, right = part.rsplit(sep, 1)
                try:
                    key = int(left)
                    val = float(right)
                    mapping[key] = val
                except Exception:
                    try:
                        weights.append(int(right))
                    except Exception:
                        continue
            else:
                try:
                    weights.append(int(part))
                except Exception:
                    continue
        if mapping:
            total_weight = sum(mapping.get(pid, 0) for pid in participants)
            if total_weight <= 0:
                return [0] * len(participants)
            return [round(total * mapping.get(pid, 0) / total_weight, 2) for pid in participants]
        if weights and len(weights) == len(participants):
            total_weight = sum(weights)
            if total_weight <= 0:
                return [0] * len(participants)
            return [round(total * w / total_weight, 2) for w in weights]
        return [0] * len(participants)

    if st in ("", "equal"):
        return _equal()
    if st == "unequal":
        return _unequal()
    if st == "percentage":
        return _percentage()
    if st == "share":
        return _share()
    return [0] * len(participants)


@router.post("/", response_model=ExpenseResponse)
def create_expense(
    expense: ExpenseCreate,
    db: Annotated[Session, Depends(get_db)]
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

    # create splits when split_with provided
    def _compute_splits(total: float, split_type: str | None, participants: list[int], details: str | None):
        if not participants:
            return []
        st = (split_type or "").strip().lower()
        # equal
        if st in ("", "equal"):
            share = round(total / len(participants), 2)
            return [share] * len(participants)

        # unequal: details may be mapping 'id value;id value' or values in order
        if st == "unequal":
            if not details:
                return [0] * len(participants)
            parts = [p.strip() for p in details.split(";") if p.strip()]
            mapping = {}
            values = []
            for part in parts:
                if ":" in part or " " in part:
                    sep = ":" if ":" in part else " "
                    left, right = part.rsplit(sep, 1)
                    try:
                        key = int(left)
                        val = float(right.replace(',', ''))
                        mapping[key] = val
                    except Exception:
                        # treat as value-only
                        try:
                            values.append(float(part.replace(',', '')))
                        except Exception:
                            continue
                else:
                    try:
                        values.append(float(part.replace(',', '')))
                    except Exception:
                        continue
            if mapping:
                return [round(mapping.get(pid, 0.0), 2) for pid in participants]
            if values and len(values) == len(participants):
                return [round(v, 2) for v in values]
            return [0] * len(participants)

        # percentage
        if st == "percentage":
            if not details:
                return [0] * len(participants)
            parts = [p.strip().rstrip('%') for p in details.split(";") if p.strip()]
            try:
                nums = [float(p) for p in parts]
                return [round(total * (n / 100.0), 2) for n in nums]
            except Exception:
                return [0] * len(participants)

        # share (weights)
        if st == "share":
            if not details:
                return [0] * len(participants)
            parts = [p.strip() for p in details.split(";") if p.strip()]
            weights = []
            mapping = {}
            for part in parts:
                if ":" in part or " " in part:
                    sep = ":" if ":" in part else " "
                    left, right = part.rsplit(sep, 1)
                    try:
                        key = int(left)
                        val = float(right)
                        mapping[key] = val
                    except Exception:
                        try:
                            weights.append(int(right))
                        except Exception:
                            continue
                else:
                    try:
                        weights.append(int(part))
                    except Exception:
                        continue
            if mapping:
                total_weight = sum(mapping.get(pid, 0) for pid in participants)
                if total_weight <= 0:
                    return [0] * len(participants)
                return [round(total * mapping.get(pid, 0) / total_weight, 2) for pid in participants]
            if weights and len(weights) == len(participants):
                total_weight = sum(weights)
                if total_weight <= 0:
                    return [0] * len(participants)
                return [round(total * w / total_weight, 2) for w in weights]
            return [0] * len(participants)

        return [0] * len(participants)

    if getattr(expense, "split_with", None):
        participants = expense.split_with or []
        if participants:
            split_amounts = _compute_splits(expense.amount, getattr(expense, "split_type", None), participants, getattr(expense, "split_details", None))
            for user_id, amt in zip(participants, split_amounts):
                split = ExpenseSplit(expense_id=db_expense.id, user_id=user_id, amount=amt)
                db.add(split)
            db.commit()

    return db_expense


@router.get("/", response_model=list[ExpenseResponse])
def get_expenses(
    db: Annotated[Session, Depends(get_db)]
):
    return db.query(Expense).all()


@router.get("/{expense_id}", response_model=ExpenseResponse)
def get_expense(
    expense_id: int,
    db: Annotated[Session, Depends(get_db)]
):
    return (
        db.query(Expense)
        .filter(Expense.id == expense_id)
        .first()
    )
    

@router.delete("/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Annotated[Session, Depends(get_db)]
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
    file: Annotated[UploadFile, File(...)],
    db: Annotated[Session, Depends(get_db)],
    group_id: int | None = None
):
    content = file.file.read().decode(errors="replace")
    reader = csv.DictReader(io.StringIO(content))

    if group_id:
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
    else:
        group = db.query(Group).filter(Group.name == "Flatmates").first()
        if not group:
            group = Group(name="Flatmates", description="Imported flatmates group")
            db.add(group)
            db.commit()
            db.refresh(group)

    report = []
    created = 0
    rows = list(reader)
    seen_hashes = set()
    seen_rows = []

    for idx, row in enumerate(rows, start=1):
        anomalies, payer_name, participants = analyze_import_row(row, seen_hashes, seen_rows)
        seen_rows.append(row)

        if payer_name:
            create_or_get_user(db, payer_name)
        for participant in participants:
            if participant:
                create_or_get_user(db, participant)

        if anomalies:
            issue = create_import_issue(
                db,
                group,
                idx,
                (row.get("description") or "Imported expense requires review").strip(),
                anomalies,
                row_to_dict(row),
            )
            report.append({
                "row": idx,
                "description": (row.get("description") or "").strip(),
                "anomalies": anomalies,
                "issue_id": issue.id,
                "raw": row,
            })
            continue

        create_expense_from_row(db, group, row)
        created += 1

    return {"created": created, "anomalies": report}
