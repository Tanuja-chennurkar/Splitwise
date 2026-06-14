from datetime import date
from pydantic import BaseModel


class ExpenseCreate(BaseModel):
    group_id: int
    paid_by: int
    description: str
    amount: float
    expense_date: date
    split_type: str | None = None
    split_with: list[int] | None = None
    split_details: str | None = None
    currency: str | None = "INR"
    original_amount: float | None = None
    exchange_rate: float | None = 1.0
    notes: str | None = None


class ExpenseResponse(BaseModel):
    id: int
    group_id: int
    paid_by: int
    description: str
    amount: float
    expense_date: date
    currency: str
    original_amount: float | None = None
    exchange_rate: float
    notes: str | None = None

    class Config:
        from_attributes = True