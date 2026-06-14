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
            "balance": 0
        }

    expenses = (
        db.query(Expense)
        .filter(Expense.group_id == group_id)
        .all()
    )

    for expense in expenses:

        balances[expense.paid_by]["balance"] += expense.amount

        splits = (
            db.query(ExpenseSplit)
            .filter(
                ExpenseSplit.expense_id == expense.id
            )
            .all()
        )

        for split in splits:
            balances[split.user_id]["balance"] -= split.amount

    return balances