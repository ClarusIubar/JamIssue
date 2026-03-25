from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..repository_normalized import delete_account


def delete_my_account_service(db: Session, user_id: str) -> None:
    """
    현재 로그인된 사용자의 계정을 삭제(탈퇴) 처리하는 서비스 함수입니다.

    의존성:
    - repository_normalized.delete_account 호출을 통해 연관된 스탬프, 루트, 댓글, 좋아요 등을 삭제합니다.
    """
    try:
        delete_account(db, user_id)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자 정보를 찾지 못했어요.",
        ) from error
