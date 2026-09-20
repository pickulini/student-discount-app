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
    UniversityName *string    `json:"university_name,omitempty"`
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

    // Настройки уведомлений
    NotifyEnabled bool `json:"notify_enabled"`
    NotifyFriends bool `json:"notify_friends"`
    NotifyEvents  bool `json:"notify_events"`
    NotifyOffers  bool `json:"notify_offers"`

    // Настройки приватности (10 полей)
    AvatarVisibility           string `json:"avatar_visibility"`
    EmailVisibility            string `json:"email_visibility"`
    UniversityVisibility       string `json:"university_visibility"`
    FriendsListVisibility      string `json:"friends_list_visibility"`
    SubscribersVisibility      string `json:"subscribers_visibility"`
    SubscriptionsVisibility    string `json:"subscriptions_visibility"`
    AttendingEventsVisibility  string `json:"attending_events_visibility"`
    OrganizingEventsVisibility string `json:"organizing_events_visibility"`
    OffersVisibility           string `json:"offers_visibility"`
    StatisticsVisibility       string `json:"statistics_visibility"`
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

    // Флаги видимости для текущего viewer-а
    AvatarVisible           bool `json:"avatar_visible"`
    EmailVisible            bool `json:"email_visible"`
    UniversityVisible       bool `json:"university_visible"`
    FriendsListVisible      bool `json:"friends_list_visible"`
    SubscribersVisible      bool `json:"subscribers_visible"`
    SubscriptionsVisible    bool `json:"subscriptions_visible"`
    AttendingEventsVisible  bool `json:"attending_events_visible"`
    OrganizingEventsVisible bool `json:"organizing_events_visible"`
    OffersVisible           bool `json:"offers_visible"`
    StatisticsVisible       bool `json:"statistics_visible"`
}
