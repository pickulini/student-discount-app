import Foundation

struct Tag: Codable, Identifiable, Hashable {
    let id: Int64
    let name: String
}

struct Offer: Codable, Identifiable {
    let id: Int64
    let title: String
    let description: String
    let basePrice: Double
    let discountType: String
    let discountValue: Double
    let specialPrice: Double?
    let status: String
    let bonusAllowed: Bool
    let maxBonusPercent: Int
    let tags: [Tag]?
    let imageURL: String?
    let address: String?
    let placeName: String?
    let phone: String?
    let website: String?
    let workingHours: String?

    let startAt: Date?
    let endAt: Date?
    let isEvent: Bool
    let attendeesCount: Int?
    let interestedCount: Int?
    /// var, а не let: после RSVP на экране деталей события мы обновляем
    /// это поле локально, не дожидаясь перезагрузки списка с сервера.
    var myAttendeeStatus: String?

    enum CodingKeys: String, CodingKey {
        case id, title, description, status, tags, address, phone, website
        case basePrice = "base_price"
        case discountType = "discount_type"
        case discountValue = "discount_value"
        case specialPrice = "special_price"
        case bonusAllowed = "bonus_allowed"
        case maxBonusPercent = "max_bonus_percent"
        case imageURL = "image_url"
        case placeName = "place_name"
        case workingHours = "working_hours"
        case startAt = "start_at"
        case endAt = "end_at"
        case isEvent = "is_event"
        case attendeesCount = "attendees_count"
        case interestedCount = "interested_count"
        case myAttendeeStatus = "my_attendee_status"
    }

    /// start_at приходит от Go-бэкенда как нулевая дата ("0001-01-01...") для
    /// обычных предложений, не событий, — не показываем её в UI в этом случае.
    var eventStartAt: Date? {
        guard isEvent, let startAt, startAt.timeIntervalSince1970 > 0 else { return nil }
        return startAt
    }

    /// Итоговая цена с учётом скидки — то, что показываем крупно в списке.
    var displayPrice: Double {
        if let specialPrice { return specialPrice }
        if discountType == "percent" {
            return basePrice * (1 - discountValue / 100)
        }
        if discountType == "fixed" {
            return max(basePrice - discountValue, 0)
        }
        return basePrice
    }

    var discountBadge: String {
        if discountType == "percent" {
            return "-\(Int(discountValue))%"
        }
        return "-\(Int(discountValue))₽"
    }

    /// image_url с бэкенда приходит относительным путём (/uploads/...) —
    /// достраиваем абсолютный URL с адресом текущего сервера.
    func absoluteImageURL(base: URL) -> URL? {
        guard let imageURL, !imageURL.isEmpty else { return nil }
        if let url = URL(string: imageURL), url.scheme != nil {
            return url
        }
        return URL(string: imageURL, relativeTo: base)
    }
}
