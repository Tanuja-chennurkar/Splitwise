from sqlalchemy import Column, Integer, ForeignKey, Date
from app.db.base import Base


class GroupMembership(Base):
    __tablename__ = "group_memberships"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"))
    group_id = Column(Integer, ForeignKey("groups.id"))

    joined_at = Column(Date, nullable=False)
    left_at = Column(Date, nullable=True)