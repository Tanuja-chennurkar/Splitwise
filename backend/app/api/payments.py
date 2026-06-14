from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Annotated
from app.db.dependencies import get_db
from app.models.payment import Payment
from app.schemas.payment import PaymentCreate, PaymentResponse
from app.models.user import User
from app.models.group import Group
from app.core.auth_dependency import get_current_user

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("/", response_model=PaymentResponse, responses={404: {"description": "Group or user not found"}})
def create_payment(payment: PaymentCreate, db: Annotated[Session, Depends(get_db)], current: Annotated[User, Depends(get_current_user)]):
    # basic validation
    group = db.query(Group).filter(Group.id == payment.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    payer = db.query(User).filter(User.id == payment.payer_id).first()
    payee = db.query(User).filter(User.id == payment.payee_id).first()
    if not payer or not payee:
        raise HTTPException(status_code=404, detail="User not found")

    db_payment = Payment(group_id=payment.group_id, payer_id=payment.payer_id, payee_id=payment.payee_id, amount=payment.amount)
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment


@router.get("/groups/{group_id}")
@router.get("/groups/{group_id}", responses={404: {"description": "Group not found"}})
def list_group_payments(group_id: int, db: Annotated[Session, Depends(get_db)], current: Annotated[User, Depends(get_current_user)]):
    return db.query(Payment).filter(Payment.group_id == group_id).all()
