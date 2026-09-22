import Foundation

struct InitPaymentRequest: Encodable {
    let amount: Double
}

struct InitPaymentResponse: Decodable {
    let paymentID: Int64
    let paymentURL: String
    let status: String

    enum CodingKeys: String, CodingKey {
        case paymentID = "payment_id"
        case paymentURL = "payment_url"
        case status
    }
}
