from datetime import datetime
from pydantic import BaseModel


class PaymentCreate(BaseModel):
    group_id: int
    payer_id: int
    payee_id: int
    amount: float


class PaymentResponse(BaseModel):
    id: int
    group_id: int
    payer_id: int
    payee_id: int
    amount: float
    created_at: datetime

    class Config:
        from_attributes = True
