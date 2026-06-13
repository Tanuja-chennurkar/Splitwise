from datetime import date
from pydantic import BaseModel


class ExpenseCreate(BaseModel):
    group_id: int
    paid_by: int
    description: str
    amount: float
    expense_date: date


class ExpenseResponse(BaseModel):
    id: int
    group_id: int
    paid_by: int
    description: str
    amount: float
    expense_date: date

    class Config:
        from_attributes = True