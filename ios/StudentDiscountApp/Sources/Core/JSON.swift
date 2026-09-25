import Foundation

/// Лёгкая обёртка над ответами API. Сервер отдаёт много разных структур,
/// и веб-клиент читает их «как есть» — здесь то же самое: `offer.title.string`,
/// `order.total_amount.double`. Отсутствующее поле — это `.null`, а не падение
/// декодера, поэтому новое или пропавшее поле на сервере не ломает экран.
@dynamicMemberLookup
enum JSON: Equatable, Hashable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSON])
    case object([String: JSON])

    init(_ any: Any?) {
        switch any {
        case nil, is NSNull: self = .null
        case let b as Bool where type(of: b) == Bool.self: self = .bool(b)
        case let n as NSNumber:
            // NSNumber из JSONSerialization: отличаем true/false от 1/0.
            if CFGetTypeID(n) == CFBooleanGetTypeID() { self = .bool(n.boolValue) } else { self = .number(n.doubleValue) }
        case let s as String: self = .string(s)
        case let a as [Any]: self = .array(a.map { JSON($0) })
        case let o as [String: Any]: self = .object(o.mapValues { JSON($0) })
        default: self = .null
        }
    }

    init(data: Data) throws {
        self = JSON(try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]))
    }

    subscript(dynamicMember key: String) -> JSON { self[key] }

    subscript(key: String) -> JSON {
        if case let .object(o) = self { return o[key] ?? .null }
        return .null
    }

    subscript(index: Int) -> JSON {
        if case let .array(a) = self, a.indices.contains(index) { return a[index] }
        return .null
    }

    var isNull: Bool { if case .null = self { return true } else { return false } }

    var string: String? {
        switch self {
        case let .string(s): return s
        case let .number(n): return n == n.rounded() ? String(Int64(n)) : String(n)
        case let .bool(b): return b ? "true" : "false"
        default: return nil
        }
    }

    /// Строка или пустая строка — удобно для Text.
    var str: String { string ?? "" }

    var double: Double? {
        switch self {
        case let .number(n): return n
        case let .string(s): return Double(s.replacingOccurrences(of: ",", with: "."))
        case let .bool(b): return b ? 1 : 0
        default: return nil
        }
    }

    var num: Double { double ?? 0 }
    var int: Int? { double.map { Int($0) } }
    var int64: Int64? { double.map { Int64($0) } }
    var id: Int64 { int64 ?? 0 }

    var bool: Bool {
        switch self {
        case let .bool(b): return b
        case let .number(n): return n != 0
        case let .string(s): return s == "true" || s == "1"
        default: return false
        }
    }

    var array: [JSON] { if case let .array(a) = self { return a } else { return [] } }
    var object: [String: JSON] { if case let .object(o) = self { return o } else { return [:] } }

    var date: Date? { string.flatMap(DateParser.parse) }

    /// Обратно в Foundation — для тела запроса.
    var any: Any {
        switch self {
        case .null: return NSNull()
        case let .bool(b): return b
        case let .number(n): return n
        case let .string(s): return s
        case let .array(a): return a.map { $0.any }
        case let .object(o): return o.mapValues { $0.any }
        }
    }
}

/// ForEach по спискам с полем id. Внимание: `x.id` — это Int64 (для Identifiable),
/// сам JSON-узел id — `x["id"]`.
extension JSON: Identifiable {}

enum DateParser {
    private static let withFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static let dayOnly: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func parse(_ s: String) -> Date? {
        if let d = withFraction.date(from: s) { return d }
        if let d = plain.date(from: s) { return d }
        // Postgres иногда отдаёт больше 3 знаков после точки — отрезаем лишнее.
        if let dot = s.firstIndex(of: "."), let tz = s[dot...].firstIndex(where: { $0 == "Z" || $0 == "+" || $0 == "-" }) {
            let frac = s[s.index(after: dot)..<tz].prefix(3)
            let fixed = String(s[..<dot]) + "." + frac + String(s[tz...])
            if let d = withFraction.date(from: fixed) { return d }
        }
        return dayOnly.date(from: String(s.prefix(10)))
    }
}
