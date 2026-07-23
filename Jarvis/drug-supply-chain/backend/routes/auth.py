from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
from jose import JWTError, jwt
import re
from ..services.security import (
    authenticate_user,
    create_access_token,
    get_password_hash,
    get_user_by_email,
    get_db,
    require_role,
)
from ..models.user import User
from ..schemas.auth import UserCreate, UserLogin, OTPVerify, AuthResponse
from ..config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


def verify_license(license_no: str) -> bool:
    """Verify CDSCO manufacturing/distribution license format.
    Format: XX/XX/YYYY/NNNNN (e.g., MH/AS/2021/00123)
    """
    if not license_no or not isinstance(license_no, str):
        return False
    pattern = r"^[A-Z]{2}/[A-Z]{2}/\d{4}/\d{5}$"
    return bool(re.match(pattern, license_no.strip().upper()))


@router.get("/check-email/{email}")
def check_email_registered(email: str, db: Session = Depends(get_db)):
    user = get_user_by_email(db, email)
    if not user:
        return {"registered": False, "verified": False}
    return {"registered": True, "verified": bool(user.verified), "role": user.role}


@router.post("/register", response_model=AuthResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    if user_in.role not in {"vendor", "distributor", "regulator"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only vendor, distributor, or regulator registration is allowed.")

    existing = get_user_by_email(db, user_in.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered.")

    if user_in.role != "regulator":
        if not verify_license(user_in.license_no or ""):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="License verification failed.")

    hashed_password = get_password_hash(user_in.password)
    user = User(
        name=user_in.name,
        email=user_in.email,
        password=hashed_password,
        role=user_in.role,
        license_no=user_in.license_no if user_in.role != "regulator" else "REGULATOR",
        verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return AuthResponse(
        access_token=None,
        token_type=None,
        role=user.role,
        user_id=user.id,
        otp_required=False,
        expires_at=None,
    )


STATIC_CREDENTIALS = {
    "admin@gmail.com": {"password": "admin@12", "role": "ADMIN", "redirectTo": "/admin/dashboard", "user_id": 1},
    "vendor@gmail.com": {"password": "vendor@12", "role": "VENDOR", "redirectTo": "/vendor/dashboard", "user_id": 2},
    "dis@gmail.com": {"password": "dis@12", "role": "DISTRIBUTOR", "redirectTo": "/distributor/dashboard", "user_id": 3},
    "reg@gmail.com": {"password": "reg@12", "role": "REGULATOR", "redirectTo": "/regulator/dashboard", "user_id": 4},
}


@router.post("/login", response_model=AuthResponse)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    email = user_in.email.lower().strip()
    password = user_in.password

    if email not in STATIC_CREDENTIALS:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    cred = STATIC_CREDENTIALS[email]
    if password != cred["password"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    user_id = cred.get("user_id", abs(hash(email)) % 9000 + 1000)

    # `email` is now embedded in the token so the frontend can restore it
    # from the JWT alone, without falling back to the numeric sub.
    access_token, expires_at = create_access_token(
        {"sub": str(user_id), "role": cred["role"].lower(), "email": email}
    )

    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        email=email,
        role=cred["role"].lower(),
        user_id=user_id,
        redirectTo=cred["redirectTo"],
        otp_required=False,
        expires_at=expires_at,
    )


@router.post("/email-password/login", response_model=AuthResponse)
def email_password_login(user_in: UserLogin, db: Session = Depends(get_db)):
    return login(user_in=user_in, db=db)


@router.post("/verify-otp", response_model=AuthResponse)
def verify_otp(payload: OTPVerify):
    if not payload.temp_token or not payload.temp_token.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing verification session. Please log in again.")

    try:
        decoded = jwt.decode(payload.temp_token.strip(), settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Verification session expired. Please log in again.")

    if not decoded.get("otp_pending") or decoded.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="OTP verification not allowed.")

    otp_code = (payload.otp or "").strip()
    if otp_code != "123456":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid OTP code.")

    user_id = int(decoded.get("sub"))
    access_token, expires_at = create_access_token({"sub": user_id, "role": "admin"})
    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        role="admin",
        user_id=user_id,
        otp_required=False,
        expires_at=expires_at,
    )


@router.patch("/users/{user_id}/verify")
def verify_user(user_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_role("admin"))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.verified = True
    db.commit()
    return {"success": True, "user_id": user_id, "verified": True}