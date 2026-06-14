from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.models.group import Group
from app.schemas.group import GroupCreate, GroupResponse
from app.models.user import User
from app.models.group_membership import GroupMembership
from app.models.expense import Expense
from app.models.expense_split import ExpenseSplit

router = APIRouter(
    prefix="/groups",
    tags=["Groups"]
)

@router.post("/", response_model=GroupResponse)
def create_group(
    group: GroupCreate,
    db: Session = Depends(get_db)
):
    db_group = Group(
        name=group.name,
        description=group.description
    )

    db.add(db_group)
    db.commit()
    db.refresh(db_group)

    return db_group

@router.get("/", response_model=list[GroupResponse])
def get_groups(db: Session = Depends(get_db)):
    return db.query(Group).all()

@router.get("/{group_id}/balances")
def get_group_balances(
    group_id: int,
    db: Session = Depends(get_db)
):
    balances = {}

    # Initialize all members who have memberships
    members = (
        db.query(User)
        .join(
            GroupMembership,
            User.id == GroupMembership.user_id
        )
        .filter(GroupMembership.group_id == group_id)
        .all()
    )

    for member in members:
        balances[member.id] = {
            "name": member.name,
            "balance": 0.0
        }

    expenses = (
        db.query(Expense)
        .filter(Expense.group_id == group_id)
        .all()
    )

    for expense in expenses:
        # If paid_by user is not initialized, initialize them
        if expense.paid_by not in balances:
            payer_user = db.query(User).filter(User.id == expense.paid_by).first()
            balances[expense.paid_by] = {
                "name": payer_user.name if payer_user else f"User {expense.paid_by}",
                "balance": 0.0
            }

        balances[expense.paid_by]["balance"] += expense.amount

        splits = (
            db.query(ExpenseSplit)
            .filter(
                ExpenseSplit.expense_id == expense.id
            )
            .all()
        )

        for split in splits:
            if split.user_id not in balances:
                split_user = db.query(User).filter(User.id == split.user_id).first()
                balances[split.user_id] = {
                    "name": split_user.name if split_user else f"User {split.user_id}",
                    "balance": 0.0
                }
            balances[split.user_id]["balance"] -= split.amount

    # apply payments (settlements) which adjust balances
    from app.models.payment import Payment
    payments = db.query(Payment).filter(Payment.group_id == group_id).all()
    for p in payments:
        # payer paid payee amount to settle; payer balance increases (reduces debt), payee decreases (reduces credit)
        if p.payer_id not in balances:
            payer_user = db.query(User).filter(User.id == p.payer_id).first()
            balances[p.payer_id] = {
                "name": payer_user.name if payer_user else f"User {p.payer_id}",
                "balance": 0.0
            }
        if p.payee_id not in balances:
            payee_user = db.query(User).filter(User.id == p.payee_id).first()
            balances[p.payee_id] = {
                "name": payee_user.name if payee_user else f"User {p.payee_id}",
                "balance": 0.0
            }
        balances[p.payer_id]["balance"] += p.amount
        balances[p.payee_id]["balance"] -= p.amount

    # Calculate suggested settlements (debt simplification)
    debtors = []  # (user_id, balance) where balance < -0.005
    creditors = []  # (user_id, balance) where balance > 0.005

    for uid, info in balances.items():
        bal = info["balance"]
        if bal < -0.005:
            debtors.append((uid, bal))
        elif bal > 0.005:
            creditors.append((uid, bal))

    debtors.sort(key=lambda x: x[1])
    creditors.sort(key=lambda x: x[1], reverse=True)

    suggested_settlements = []
    d_idx = 0
    c_idx = 0
    d_list = [[uid, bal] for uid, bal in debtors]
    c_list = [[uid, bal] for uid, bal in creditors]

    while d_idx < len(d_list) and c_idx < len(c_list):
        d_uid, d_bal = d_list[d_idx]
        c_uid, c_bal = c_list[c_idx]

        transfer = min(abs(d_bal), c_bal)
        if transfer > 0.005:
            suggested_settlements.append({
                "from_user_id": d_uid,
                "from_user_name": balances[d_uid]["name"],
                "to_user_id": c_uid,
                "to_user_name": balances[c_uid]["name"],
                "amount": round(transfer, 2)
            })

        d_list[d_idx][1] += transfer
        c_list[c_idx][1] -= transfer

        if abs(d_list[d_idx][1]) < 0.005:
            d_idx += 1
        if abs(c_list[c_idx][1]) < 0.005:
            c_idx += 1

    return {
        "balances": balances,
        "suggested_settlements": suggested_settlements
    }


@router.get("/{group_id}/members/{user_id}/ledger")
def get_member_ledger(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db)
):
    ledger = []

    # 1. Fetch all expenses in the group
    expenses = db.query(Expense).filter(Expense.group_id == group_id).all()

    for expense in expenses:
        split = db.query(ExpenseSplit).filter(
            ExpenseSplit.expense_id == expense.id,
            ExpenseSplit.user_id == user_id
        ).first()

        is_payer = (expense.paid_by == user_id)
        is_participant = (split is not None)

        if not is_payer and not is_participant:
            continue

        own_share = split.amount if split else 0.0

        if is_payer and is_participant:
            net_effect = expense.amount - own_share
            ledger.append({
                "id": expense.id,
                "type": "expense_paid_and_split",
                "date": expense.expense_date,
                "description": expense.description,
                "currency": expense.currency,
                "original_amount": expense.original_amount or expense.amount,
                "exchange_rate": expense.exchange_rate,
                "total_amount_inr": expense.amount,
                "your_share_inr": own_share,
                "net_effect_inr": round(net_effect, 2),
                "notes": expense.notes
            })
        elif is_payer:
            net_effect = expense.amount
            ledger.append({
                "id": expense.id,
                "type": "expense_paid_only",
                "date": expense.expense_date,
                "description": expense.description,
                "currency": expense.currency,
                "original_amount": expense.original_amount or expense.amount,
                "exchange_rate": expense.exchange_rate,
                "total_amount_inr": expense.amount,
                "your_share_inr": 0.0,
                "net_effect_inr": round(net_effect, 2),
                "notes": expense.notes
            })
        elif is_participant:
            net_effect = -own_share
            payer_user = db.query(User).filter(User.id == expense.paid_by).first()
            payer_name = payer_user.name if payer_user else "Unknown"
            ledger.append({
                "id": expense.id,
                "type": "expense_participant_only",
                "date": expense.expense_date,
                "description": f"{expense.description} (Paid by {payer_name})",
                "currency": expense.currency,
                "original_amount": expense.original_amount or expense.amount,
                "exchange_rate": expense.exchange_rate,
                "total_amount_inr": expense.amount,
                "your_share_inr": own_share,
                "net_effect_inr": round(net_effect, 2),
                "notes": expense.notes
            })

    # 2. Fetch all payments in the group
    from app.models.payment import Payment
    payments = db.query(Payment).filter(Payment.group_id == group_id).all()
    for p in payments:
        if p.payer_id == user_id:
            payee_user = db.query(User).filter(User.id == p.payee_id).first()
            payee_name = payee_user.name if payee_user else "Unknown"
            ledger.append({
                "id": p.id,
                "type": "payment_made",
                "date": p.created_at.date() if hasattr(p.created_at, "date") else p.created_at,
                "description": f"Settlement paid to {payee_name}",
                "currency": "INR",
                "original_amount": p.amount,
                "exchange_rate": 1.0,
                "total_amount_inr": p.amount,
                "your_share_inr": 0.0,
                "net_effect_inr": round(p.amount, 2),
                "notes": None
            })
        elif p.payee_id == user_id:
            payer_user = db.query(User).filter(User.id == p.payer_id).first()
            payer_name = payer_user.name if payer_user else "Unknown"
            ledger.append({
                "id": p.id,
                "type": "payment_received",
                "date": p.created_at.date() if hasattr(p.created_at, "date") else p.created_at,
                "description": f"Settlement received from {payer_name}",
                "currency": "INR",
                "original_amount": p.amount,
                "exchange_rate": 1.0,
                "total_amount_inr": p.amount,
                "your_share_inr": 0.0,
                "net_effect_inr": round(-p.amount, 2),
                "notes": None
            })

    ledger.sort(key=lambda x: x["date"])
    return ledger