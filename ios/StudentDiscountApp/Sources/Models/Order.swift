import Foundation

struct Order: Codable, Identifiable {
    let id: Int64
    let offerID: Int64
    let subtotal: Double
    let discountAmount: Double
    let bonusAmount: Double
    let totalAmount: Double
    let status: String
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, subtotal, status
        case offerID = "offer_id"
        case discountAmount = "discount_amount"
        case bonusAmount = "bonus_amount"
        case totalAmount = "total_amount"
        case createdAt = "created_at"
    }

    var statusLabel: String {
        switch status {
        case "created": return "Оформлен"
        case "paid": return "Оплачен"
        case "completed": return "Завершён"
        case "cancelled": return "Отменён"
        case "refunded": return "Возврат"
        case "failed": return "Не удался"
        default: return status
        }
    }
}

struct CreateOrderRequest: Encodable {
    let offerID: Int64
    let bonusPoints: Double

    enum CodingKeys: String, CodingKey {
        case offerID = "offer_id"
        case bonusPoints = "bonus_points"
    }
}
