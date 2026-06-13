from datetime import date
from pydantic import BaseModel


class MembershipCreate(BaseModel):
    user_id: int
    joined_at: date
    left_at: date | None = None


class MembershipResponse(BaseModel):
    id: int
    user_id: int
    group_id: int
    joined_at: date
    left_at: date | None = None

    class Config:
        from_attributes = True
        
