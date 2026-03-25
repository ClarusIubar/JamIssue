from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import CommentCreate, ReviewCreate, ReviewLikeResponse, ReviewOut, SessionUser
from ..repository_normalized import (
    create_comment,
    create_review,
    delete_comment,
    delete_review,
    get_review_comments,
    toggle_review_like,
)


def create_review_service(db: Session, payload: ReviewCreate, session_user: SessionUser) -> ReviewOut:
    """
    사용자가 작성한 새로운 리뷰(피드)를 검증하고 DB에 생성합니다.
    """
    try:
        return create_review(db, payload, session_user.id, session_user.nickname)
    except ValueError as error:
        detail = str(error)
        status_code = status.HTTP_400_BAD_REQUEST
        if "장소" in detail:
            status_code = status.HTTP_404_NOT_FOUND
        raise HTTPException(status_code=status_code, detail=detail) from error


def delete_review_service(db: Session, review_id: str, session_user: SessionUser) -> None:
    """
    특정 리뷰를 삭제합니다. 본인의 리뷰만 삭제할 수 있으나 관리자 권한이 있으면 예외입니다.
    """
    try:
        delete_review(db, review_id, session_user.id, is_admin=session_user.is_admin)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error


def toggle_review_like_service(db: Session, review_id: str, session_user: SessionUser) -> ReviewLikeResponse:
    """
    특정 리뷰에 대한 사용자의 좋아요를 토글(추가/삭제)합니다. 본인 리뷰에는 좋아요를 남길 수 없습니다.
    """
    try:
        return toggle_review_like(db, review_id, session_user.id, session_user.nickname)
    except ValueError as error:
        detail = str(error)
        status_code = status.HTTP_400_BAD_REQUEST
        if "찾지 못" in detail:
            status_code = status.HTTP_404_NOT_FOUND
        raise HTTPException(status_code=status_code, detail=detail) from error


def read_review_comments_service(db: Session, review_id: str):
    """
    단일 리뷰에 달린 모든 댓글(대댓글 포함 트리 구조)을 조회하여 반환합니다.
    """
    try:
        return get_review_comments(db, review_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


def create_comment_service(db: Session, review_id: str, payload: CommentCreate, session_user: SessionUser):
    """
    특정 리뷰에 새 댓글을 추가합니다. parent_id가 제공되면 해당 댓글의 대댓글로 작성됩니다.
    완료 시 최신 상태의 댓글 트리를 반환합니다.
    """
    try:
        return create_comment(db, review_id, payload, session_user.id, session_user.nickname)
    except ValueError as error:
        detail = str(error)
        status_code = status.HTTP_400_BAD_REQUEST
        if "후기" in detail:
            status_code = status.HTTP_404_NOT_FOUND
        raise HTTPException(status_code=status_code, detail=detail) from error


def delete_comment_service(db: Session, review_id: str, comment_id: str, session_user: SessionUser):
    """
    특정 댓글을 삭제(소프트 삭제)합니다. 자식(대댓글)이 있어도 참조 유지를 위해 DB 레코드는 유지됩니다.
    완료 시 최신 상태의 댓글 트리를 반환합니다.
    """
    try:
        return delete_comment(db, review_id, comment_id, session_user.id, is_admin=session_user.is_admin)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
