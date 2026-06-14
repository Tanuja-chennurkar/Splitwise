from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.models.group_membership import GroupMembership
from app.schemas.group_membership import (
    MembershipCreate,
    MembershipResponse
)
from app.models.user import User
router = APIRouter(
    prefix="/memberships",
    tags=["Memberships"]
)

@router.post(
    "/groups/{group_id}",
    response_model=MembershipResponse
)
def add_member(
    group_id: int,
    membership: MembershipCreate,
    db: Session = Depends(get_db)
):
    db_membership = GroupMembership(
        group_id=group_id,
        user_id=membership.user_id,
        joined_at=membership.joined_at,
        left_at=membership.left_at
    )

    db.add(db_membership)
    db.commit()
    db.refresh(db_membership)

    return db_membership

@router.get("/groups/{group_id}")
def get_group_members(
    group_id: int,
    db: Session = Depends(get_db)
):
    members = (
        db.query(
            User.id,
            User.name,
            User.email,
            GroupMembership.joined_at,
            GroupMembership.left_at,
            GroupMembership.id.label("membership_id")
        )
        .join(
            GroupMembership,
            User.id == GroupMembership.user_id
        )
        .filter(GroupMembership.group_id == group_id)
        .all()
    )

    return [
        {
            "id": member.id,
            "name": member.name,
            "email": member.email,
            "joined_at": member.joined_at,
            "left_at": member.left_at,
            "membership_id": member.membership_id
        }
        for member in members
    ]


@router.patch("/{membership_id}", response_model=MembershipResponse)
def update_membership(
    membership_id: int,
    membership: MembershipCreate,
    db: Session = Depends(get_db)
):
    db_membership = db.query(GroupMembership).filter(GroupMembership.id == membership_id).first()
    if not db_membership:
        return None
    db_membership.user_id = membership.user_id
    db_membership.joined_at = membership.joined_at
    db_membership.left_at = membership.left_at
    db.add(db_membership)
    db.commit()
    db.refresh(db_membership)
    return db_membership


@router.delete("/{membership_id}")
def delete_membership(membership_id: int, db: Session = Depends(get_db)):
    db.query(GroupMembership).filter(GroupMembership.id == membership_id).delete()
    db.commit()
    return {"message": "deleted"}