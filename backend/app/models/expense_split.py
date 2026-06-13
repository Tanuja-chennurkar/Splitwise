from sqlalchemy import Column, Integer, Float, ForeignKey

from app.db.base import Base


class ExpenseSplit(Base):
    __tablename__ = "expense_splits"

    id = Column(Integer, primary_key=True, index=True)

    expense_id = Column(
        Integer,
        ForeignKey("expenses.id"),
        nullable=False
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    amount = Column(
        Float,
        nullable=False
    )