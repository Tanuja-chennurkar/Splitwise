from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models to register them on Base.metadata
from app.models.user import User
from app.models.group import Group
from app.models.group_membership import GroupMembership
from app.models.expense import Expense
from app.models.expense_split import ExpenseSplit
from app.models.payment import Payment
from app.models.import_issue import ImportIssue