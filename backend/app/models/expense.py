from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date

from app.db.base import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)

    group_id = Column(Integer, ForeignKey("groups.id"))
    paid_by = Column(Integer, ForeignKey("users.id"))

    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    expense_date = Column(Date, nullable=False)

    currency = Column(String, nullable=False, default="INR")
    original_amount = Column(Float, nullable=True)
    exchange_rate = Column(Float, nullable=False, default=1.0)
    notes = Column(String, nullable=True)