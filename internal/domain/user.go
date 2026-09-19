package domain

import "time"

type User struct {
    ID             int64      `json:"id"`
    Email          string     `json:"email"`
    PasswordHash   string     `json:"-"`
    FullName       string     `json:"full_name"`
    Nickname       *string    `json:"nickname,omitempty"`
    Username       *string    `json:"username,omitempty"`
    AvatarURL      *string    `json:"avatar_url,omitempty"`
    UniversityID   *int64     `json:"university_id,omitempty"`
    Course         *int       `json:"course,omitempty"`
    BirthDate      *time.Time `json:"birth_date,omitempty"`
    StudentStatus  string     `json:"student_status"`
    ReferralCode   string     `json:"referral_code"`
    ReferredBy     *int64     `json:"referred_by,omitempty"`
    IsActive       bool       `json:"is_active"`
    Balance        float64    `json:"balance"`
    Role           string     `json:"role"`
    VerificationExpiresAt *time.Time `json:"student_verification_expires_at,omitempty"`
    PrivacyAllowSubscriptions bool `json:"privacy_allow_subscriptions"`
    CreatedAt      time.Time  `json:"created_at"`
    UpdatedAt      time.Time  `json:"updated_at"`
}

type StudentVerification struct {
    ID               int64      `json:"id"`
    UserID           int64      `json:"user_id"`
    Method           string     `json:"method"`
    Status           string     `json:"status"`
    UniversityID     *int64     `json:"university_id,omitempty"`
    StudentIdentifier string    `json:"student_identifier,omitempty"`
    DocumentKey      string     `json:"document_key,omitempty"`
    VerifiedBy       *int64     `json:"verified_by,omitempty"`
    VerifiedAt       *time.Time `json:"verified_at,omitempty"`
    ExpiresAt        *time.Time `json:"expires_at,omitempty"`
    RejectionReason  string     `json:"rejection_reason,omitempty"`
    CreatedAt        time.Time  `json:"created_at"`
    UpdatedAt        time.Time  `json:"updated_at"`
}

type UserSession struct {
    ID             int64      `json:"id"`
    UserID         int64      `json:"user_id"`
    RefreshTokenHash string   `json:"-"`
    DeviceName     string     `json:"device_name,omitempty"`
    UserAgent      string     `json:"user_agent,omitempty"`
    IP             string     `json:"ip,omitempty"`
    CreatedAt      time.Time  `json:"created_at"`
    LastUsedAt     time.Time  `json:"last_used_at"`
    ExpiresAt      time.Time  `json:"expires_at"`
    RevokedAt      *time.Time `json:"revoked_at,omitempty"`
}

// Публичный профиль — то, что видно по ссылке /@username
type UserPublicProfile struct {
    ID                 int64     `json:"id"`
    Username           string    `json:"username"`
    Nickname           *string   `json:"nickname,omitempty"`
    FullName           string    `json:"full_name"`
    AvatarURL          *string   `json:"avatar_url,omitempty"`
    University         *string   `json:"university,omitempty"`
    StudentStatus      string    `json:"student_status"`
    Role               string    `json:"role"`
    FriendsCount       int       `json:"friends_count"`
    AllowSubscriptions bool      `json:"allow_subscriptions"`
    CreatedAt          time.Time `json:"created_at"`
}
