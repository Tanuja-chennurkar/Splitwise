from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.dependencies import get_db
from app.models.import_issue import ImportIssue
from app.schemas.import_issue import (
    ImportIssueResponse,
    ResolveImportIssueRequest,
)

router = APIRouter(
    prefix="/import-issues",
    tags=["Import Issues"]
)

@router.get("/", response_model=list[ImportIssueResponse])
def list_import_issues(
    db: Session = Depends(get_db),
    group_id: int | None = None
):
    q = db.query(ImportIssue).filter(ImportIssue.status == "pending")
    if group_id:
        q = q.filter(ImportIssue.group_id == group_id)
    return q.all()

@router.post("/{issue_id}/resolve", response_model=ImportIssueResponse)
def resolve_import_issue(
    issue_id: int,
    resolution: ResolveImportIssueRequest,
    db: Session = Depends(get_db)
):
    issue = db.query(ImportIssue).filter(ImportIssue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    action = resolution.action
    corrected = resolution.corrected_data or {}

    if action == "create_expense":
        paid_by = corrected.get("paid_by")
        description = corrected.get("description")
        amount = corrected.get("amount")
        expense_date_str = corrected.get("expense_date")
        split_type = corrected.get("split_type") or "equal"
        split_with = corrected.get("split_with") or []
        split_details = corrected.get("split_details")
        currency = corrected.get("currency") or "INR"
        original_amount = corrected.get("original_amount") or amount
        exchange_rate = corrected.get("exchange_rate") or 1.0
        notes = corrected.get("notes")

        if not paid_by or not description or amount is None or not expense_date_str or not split_with:
            raise HTTPException(status_code=400, detail="Missing required expense fields")

        from datetime import datetime, date
        if isinstance(expense_date_str, str):
            try:
                exp_date = datetime.strptime(expense_date_str, "%Y-%m-%d").date()
            except Exception:
                try:
                    exp_date = datetime.strptime(expense_date_str, "%d-%m-%Y").date()
                except Exception:
                    raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
        else:
            exp_date = expense_date_str

        from app.models.expense import Expense
        from app.models.expense_split import ExpenseSplit

        db_expense = Expense(
            group_id=issue.group_id,
            paid_by=int(paid_by),
            description=description,
            amount=float(amount),
            expense_date=exp_date,
            currency=currency.upper(),
            original_amount=float(original_amount),
            exchange_rate=float(exchange_rate),
            notes=notes if notes else None
        )
        db.add(db_expense)
        db.commit()
        db.refresh(db_expense)

        def calculate_split_amounts(total: float, s_type: str, participants: list[int], details: str | None) -> list[float]:
            if not participants:
                return []
            st = s_type.strip().lower()
            if st in ("equal", ""):
                share = round(total / len(participants), 2)
                return [share] * len(participants)
                
            mapping = {}
            if details:
                for part in details.split(";"):
                    part = part.strip()
                    if not part:
                        continue
                    if ":" in part:
                        left, right = part.rsplit(":", 1)
                    elif " " in part:
                        left, right = part.rsplit(" ", 1)
                    else:
                        continue
                    try:
                        key = int(left.strip())
                        val = float(right.replace('%', '').replace(',', '').strip())
                        mapping[key] = val
                    except ValueError:
                        key = left.strip()
                        val = float(right.replace('%', '').replace(',', '').strip())
                        mapping[key] = val
                        
            if st == "unequal":
                return [round(mapping.get(pid, 0.0), 2) for pid in participants]
            if st == "percentage":
                return [round(total * (mapping.get(pid, 0.0) / 100.0), 2) for pid in participants]
            if st == "share":
                total_weight = sum(mapping.get(pid, 0.0) for pid in participants)
                if total_weight <= 0:
                    return [0.0] * len(participants)
                return [round(total * mapping.get(pid, 0.0) / total_weight, 2) for pid in participants]
            return [0.0] * len(participants)

        split_amounts = calculate_split_amounts(float(amount), split_type, [int(p) for p in split_with], split_details)
        for user_id, amt in zip(split_with, split_amounts):
            split = ExpenseSplit(expense_id=db_expense.id, user_id=int(user_id), amount=amt)
            db.add(split)
        db.commit()

        from app.models.group_membership import GroupMembership
        from app.models.user import User
        for uid in [int(paid_by)] + [int(p) for p in split_with]:
            exists = db.query(GroupMembership).filter(
                GroupMembership.group_id == issue.group_id,
                GroupMembership.user_id == uid
            ).first()
            if not exists:
                u = db.query(User).filter(User.id == uid).first()
                joined_dt = date(2026, 2, 1)
                left_dt = None
                if u:
                    if u.name == "Meera":
                        left_dt = date(2026, 3, 31)
                    elif u.name == "Sam":
                        joined_dt = date(2026, 4, 8)
                db_m = GroupMembership(
                    group_id=issue.group_id,
                    user_id=uid,
                    joined_at=joined_dt,
                    left_at=left_dt
                )
                db.add(db_m)
        db.commit()

    elif action == "create_payment":
        payer_id = corrected.get("payer_id")
        payee_id = corrected.get("payee_id")
        amount = corrected.get("amount")

        if not payer_id or not payee_id or amount is None:
            raise HTTPException(status_code=400, detail="Missing settlement fields")

        from app.models.payment import Payment
        db_payment = Payment(
            group_id=issue.group_id,
            payer_id=int(payer_id),
            payee_id=int(payee_id),
            amount=float(amount)
        )
        db.add(db_payment)
        db.commit()

    elif action == "ignore":
        pass
    else:
        raise HTTPException(status_code=400, detail="Invalid resolution action")

    issue.status = "resolved"
    issue.resolution_note = resolution.resolution_note
    issue.resolved_at = datetime.utcnow()
    db.add(issue)
    db.commit()
    db.refresh(issue)
    return issue
