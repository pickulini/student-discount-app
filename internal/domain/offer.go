package domain

import (
    "encoding/json"
    "time"
)

type Offer struct {
    ID              int64      `json:"id"`
    CompanyID       *int64     `json:"company_id,omitempty"`
    Title           string     `json:"title"`
    Description     string     `json:"description"`
    Terms           *string    `json:"terms,omitempty"`
    DiscountType    string     `json:"discount_type"`
    DiscountValue   float64    `json:"discount_value"`
    SpecialPrice    *float64   `json:"special_price,omitempty"`
    StartAt         time.Time  `json:"start_at"`
    EndAt           time.Time  `json:"end_at"`
    Status          string     `json:"status"`
    MaxUses         *int       `json:"max_uses,omitempty"`
    CurrentUses     int        `json:"current_uses"`
    BonusAllowed    bool       `json:"bonus_allowed"`
    MaxBonusPercent int        `json:"max_bonus_percent"`
    Tags            []Tag      `json:"tags,omitempty"`
    ImageURL        *string    `json:"image_url,omitempty"`
    Address         *string    `json:"address,omitempty"`
    Latitude        *float64   `json:"latitude,omitempty"`
    Longitude       *float64   `json:"longitude,omitempty"`
    PlaceName       *string    `json:"place_name,omitempty"`
    Phone           *string    `json:"phone,omitempty"`
    Website         *string    `json:"website,omitempty"`
    WorkingHours    *string    `json:"working_hours,omitempty"`
    RejectionReason *string    `json:"rejection_reason,omitempty"`

    // Event-поля (актуальны только когда IsEvent = true)
    IsEvent           bool       `json:"is_event"`
    OrganizerID       *int64     `json:"organizer_id,omitempty"`
    EventPrivacy      string     `json:"event_privacy,omitempty"`
    EventUniversityID *int64     `json:"event_university_id,omitempty"`
    AttendeesCount    int        `json:"attendees_count,omitempty"`
    MyAttendeeStatus  *string    `json:"my_attendee_status,omitempty"`

    // Админские правки до подтверждения партнёром
    AdminEditedData      json.RawMessage `json:"admin_edited_data,omitempty"` // JSONB с полями, которые админ изменил
    AdminEditComment     *string `json:"admin_edit_comment,omitempty"`
    PartnerRejectComment *string `json:"partner_reject_comment,omitempty"`

    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

const OfferStatusPendingPartnerApproval = "pending_partner_approval"
