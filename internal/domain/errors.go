package domain

import "errors"

var (
    ErrUserNotFound          = errors.New("user not found")
    ErrEmailAlreadyExists    = errors.New("email already exists")
    ErrInvalidCredentials    = errors.New("invalid credentials")
    ErrInvalidReferralCode   = errors.New("invalid referral code")
    ErrStudentNotVerified    = errors.New("student not verified")
    ErrVerificationPending   = errors.New("verification is pending")
    ErrVerificationExpired   = errors.New("verification expired")
    ErrInvalidToken          = errors.New("invalid token")
    ErrSessionNotFound       = errors.New("session not found")
    ErrAccountNotFound       = errors.New("account not found")
    ErrInsufficientBalance   = errors.New("insufficient balance")
    ErrBonusAccountNotFound  = errors.New("bonus account not found")
    ErrInsufficientBonuses   = errors.New("insufficient bonus points")
    ErrIdempotencyKeyExists  = errors.New("idempotency key already exists")
    ErrUnauthorized          = errors.New("unauthorized")
    ErrForbidden             = errors.New("forbidden")
)

var ErrInvalidStatus = errors.New("invalid status transition")
