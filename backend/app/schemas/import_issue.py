from datetime import datetime
from pydantic import BaseModel


class ImportIssueResponse(BaseModel):
    id: int
    group_id: int
    row_number: int
    description: str
    anomalies: str
    raw_data: str
    status: str
    resolution_note: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None

    class Config:
        from_attributes = True


class ResolveImportIssueRequest(BaseModel):
    action: str
    resolution_note: str
