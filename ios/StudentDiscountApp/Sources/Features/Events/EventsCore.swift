import Foundation

/// Повторения ивентов, подписи и «Пойду» — как utils/events.js на сайте.
enum EventsCore {
    struct Occurrence { let start: Date; let end: Date }

    private static func freq(_ e: JSON) -> String? {
        let r = e.recurrence_rule.str
        for f in ["DAILY", "WEEKLY", "MONTHLY"] where r.contains("FREQ=\(f)") { return f }
        return nil
    }

    private static func step(_ d: Date, _ f: String) -> Date {
        let c = Calendar.current
        switch f {
        case "DAILY": return c.date(byAdding: .day, value: 1, to: d)!
        case "WEEKLY": return c.date(byAdding: .day, value: 7, to: d)!
        default: return c.date(byAdding: .month, value: 1, to: d)!
        }
    }

    /// Все начала ивента в интервале [from, to).
    static func occurrences(_ e: JSON, from: Date, to: Date) -> [Occurrence] {
        guard let start = e.start_at.date else { return [] }
        let dur = max(0, (e.end_at.date ?? start.addingTimeInterval(7200)).timeIntervalSince(start))
        guard let f = freq(e) else {
            let end = start.addingTimeInterval(dur)
            return end >= from && start < to ? [Occurrence(start: start, end: end)] : []
        }
        let until = e.recurrence_until.date
        var out: [Occurrence] = []
        var t = start
        var i = 0
        while i < 1000 && t < to {
            if let until, t > until { break }
            let end = t.addingTimeInterval(dur)
            if end >= from { out.append(Occurrence(start: t, end: end)) }
            t = step(t, f)
            i += 1
        }
        return out
    }

    /// Ближайшее ещё не закончившееся начало (или исходное, если всё в прошлом).
    static func next(_ e: JSON, now: Date = Date()) -> Occurrence {
        if let first = occurrences(e, from: now, to: now.addingTimeInterval(400 * 86400)).first { return first }
        let s = e.start_at.date ?? now
        return Occurrence(start: s, end: e.end_at.date ?? s)
    }

    private static let weekdaysAcc = ["воскресенье", "понедельник", "вторник", "среду", "четверг", "пятницу", "субботу"]
    private static let everyBy = ["каждое", "каждый", "каждый", "каждую", "каждый", "каждую", "каждую"]

    /// «каждую среду», «каждый день», «каждый месяц».
    static func recurrenceLabel(_ e: JSON) -> String {
        guard let f = freq(e) else { return "" }
        if f == "DAILY" { return "каждый день" }
        if f == "MONTHLY" { return "каждый месяц" }
        let wd = Calendar.current.component(.weekday, from: e.start_at.date ?? Date()) - 1
        return "\(everyBy[wd]) \(weekdaysAcc[wd])"
    }

    static func price(_ e: JSON, _ meta: JSON = .null) -> Double {
        meta.special_price.double ?? e.special_price.double ?? 0
    }

    static func priceLabel(_ p: Double) -> String { p > 0 ? Fmt.rub(p) : "БЕСПЛАТНО" }

    /// Подписи ивентов (компания, организатор, мой статус) пачкой.
    static func meta(_ ids: [Int64]) async -> [String: JSON] {
        guard !ids.isEmpty else { return [:] }
        let r = try? await API.shared.get("events/meta", ["ids": ids.map(String.init).joined(separator: ",")])
        return r?.object ?? [:]
    }

    /// «Пойду»: бесплатный — запись сразу; платный — заказ и оплата с кошелька.
    @discardableResult
    static func go(_ id: Int64) async throws -> JSON {
        let order = try await API.shared.post("events/\(id)/schedule")
        if !order.isNull, !["paid", "completed"].contains(order.status.str), order["id"].id > 0 {
            try await API.shared.post("orders/\(order["id"].id)/confirm")
        }
        return order
    }
}
