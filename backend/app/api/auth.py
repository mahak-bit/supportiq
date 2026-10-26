from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import User
from app.schemas import LoginIn, UserOut
from app.security import COOKIE_NAME, create_token, current_user, limiter, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)) -> User:
    s = get_settings()
    ip = request.client.host if request.client else "unknown"
    limiter.check(f"login:{ip}", s.login_rate_limit_per_minute)
    user = db.scalar(select(User).where(func.lower(User.email) == body.email.strip().lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "That email and password don't match an account.")
    response.set_cookie(
        COOKIE_NAME, create_token(user), httponly=True, secure=s.cookie_secure, samesite="lax",
        max_age=s.jwt_ttl_minutes * 60, path="/",
    )
    return user


@router.post("/logout", status_code=204, response_class=Response)
def logout(response: Response) -> Response:
    response.delete_cookie(COOKIE_NAME, path="/")
    response.status_code = 204
    return response


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> User:
    return user
