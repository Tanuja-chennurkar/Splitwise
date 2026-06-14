from sqlalchemy import Column, Integer, ForeignKey, String, Text, DateTime
from datetime import datetime

from app.db.base import Base


class ImportIssue(Base):
    __tablename__ = "import_issues"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    row_number = Column(Integer, nullable=False)
    description = Column(String, nullable=False)
    anomalies = Column(Text, nullable=False)
    raw_data = Column(Text, nullable=False)
    status = Column(String, nullable=False, default="pending")
    resolution_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
