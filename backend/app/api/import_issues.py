from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.dependencies import get_db
from app.models.import_issue import ImportIssue
from app.schemas.import_issue import (
    ImportIssueResponse,
    ResolveImportIssueRequest,
)

router = APIRouter(
    prefix="/import-issues",
    tags=["Import Issues"]
)

@router.get("/", response_model=list[ImportIssueResponse])
def list_import_issues(
    db: Session = Depends(get_db),
    group_id: int | None = None
):
    q = db.query(ImportIssue).filter(ImportIssue.status == "pending")
    if group_id:
        q = q.filter(ImportIssue.group_id == group_id)
    return q.all()

@router.post("/{issue_id}/resolve", response_model=ImportIssueResponse)
def resolve_import_issue(
    issue_id: int,
    resolution: ResolveImportIssueRequest,
    db: Session = Depends(get_db)
):
    issue = db.query(ImportIssue).filter(ImportIssue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    issue.status = "resolved"
    issue.resolution_note = resolution.resolution_note
    issue.resolved_at = datetime.utcnow()
    db.add(issue)
    db.commit()
    db.refresh(issue)
    return issue
