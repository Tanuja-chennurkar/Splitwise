from fastapi import FastAPI
from sqlalchemy import text

from app.db.database import engine
from app.db.base import Base
from app.api.users import router as user_router
from app.models.group import Group
from app.api.groups import router as group_router
from app.models.group_membership import GroupMembership
from app.api.group_memberships import (
    router as membership_router
)
from app.models.expense import Expense
from app.api.expenses import router as expense_router
from app.api.expense_splits import router as expense_split_router

from fastapi.middleware.cors import CORSMiddleware


# Import models
from app.models.user import User

Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(user_router)
app.include_router(group_router)
app.include_router(membership_router)
app.include_router(expense_router)
app.include_router(expense_split_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Splitwise API Running"}


@app.get("/health")
def health_check():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))

    return {"status": "Database Connected"}

