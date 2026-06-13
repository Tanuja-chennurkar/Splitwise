from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.models.expense import Expense
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseResponse
)

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