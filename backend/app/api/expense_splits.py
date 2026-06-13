from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.models.expense_split import ExpenseSplit
from app.schemas.expense_split import (
    ExpenseSplitCreate,
    ExpenseSplitResponse
)

router = APIRouter(
    prefix="/expense-splits",
    tags=["Expense Splits"]
)


@router.post(
    "/expenses/{expense_id}",
    response_model=ExpenseSplitResponse
)
def create_split(
    expense_id: int,
    split: ExpenseSplitCreate,
    db: Session = Depends(get_db)
):
    db_split = ExpenseSplit(
        expense_id=expense_id,
        user_id=split.user_id,
        amount=split.amount
    )

    db.add(db_split)
    db.commit()
    db.refresh(db_split)

    return db_split


@router.get("/expenses/{expense_id}")
def get_splits(
    expense_id: int,
    db: Session = Depends(get_db)
):
    return (
        db.query(ExpenseSplit)
        .filter(ExpenseSplit.expense_id == expense_id)
        .all()
    )