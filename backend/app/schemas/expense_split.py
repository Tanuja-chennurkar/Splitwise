from pydantic import BaseModel


class ExpenseSplitCreate(BaseModel):
    user_id: int
    amount: float


class ExpenseSplitResponse(BaseModel):
    id: int
    expense_id: int
    user_id: int
    amount: float

    class Config:
        from_attributes = True