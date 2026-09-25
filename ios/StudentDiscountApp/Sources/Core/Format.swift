import Foundation

/// Форматирование «как на кассе» — те же правила, что на сайте.
enum Fmt {
    static let moscow = TimeZone(identifier: "Europe/Moscow") ?? .current
    private static let ru = Locale(identifier: "ru_RU")

    private static let grouping: NumberFormatter = {
        let f = NumberFormatter()
        f.locale = ru
        f.numberStyle = .decimal
        f.groupingSeparator = "\u{00A0}"
        f.maximumFractionDigits = 0
        return f
    }()

    /// 1450 → «1 450»
    static func num(_ v: Double) -> String { grouping.string(from: NSNumber(value: v.rounded())) ?? "\(Int(v))" }

    /// 1450 → «1 450 ₽»
    static func rub(_ v: Double) -> String { "\(num(v))\u{00A0}₽" }

    /// Со знаком: «+1 000 ₽», «−210 ₽».
    static func signed(_ v: Double, unit: String = "₽") -> String {
        let s = v > 0 ? "+" : v < 0 ? "−" : ""
        return "\(s)\(num(abs(v)))\u{00A0}\(unit)"
    }

    private static func fmt(_ pattern: String) -> DateFormatter {
        let f = DateFormatter()
        f.locale = ru
        f.timeZone = .current
        f.dateFormat = pattern
        return f
    }

    private static let fDDMM = fmt("dd.MM")
    private static let fDDMMYY = fmt("dd.MM.yy")
    private static let fHHMM = fmt("HH:mm")

    static func ddmm(_ d: Date?) -> String { d.map { fDDMM.string(from: $0) } ?? "—" }
    static func ddmmyy(_ d: Date?) -> String { d.map { fDDMMYY.string(from: $0) } ?? "—" }
    static func hhmm(_ d: Date?) -> String { d.map { fHHMM.string(from: $0) } ?? "—" }

    static let weekdaysShort = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"]
    static let monthsShort = ["ЯНВ", "ФЕВ", "МАР", "АПР", "МАЙ", "ИЮН", "ИЮЛ", "АВГ", "СЕН", "ОКТ", "НОЯ", "ДЕК"]
    static let monthsNom = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"]
    static let monthsGen = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
    static let weekdaysFull = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"]

    static func weekday(_ d: Date) -> String { weekdaysShort[Calendar.current.component(.weekday, from: d) - 1] }

    /// «ЧЕТВЕРГ, 25 СЕНТЯБРЯ»
    static func dayTitle(_ d: Date) -> String {
        let c = Calendar.current
        return "\(weekdaysFull[c.component(.weekday, from: d) - 1]), \(c.component(.day, from: d)) \(monthsGen[c.component(.month, from: d) - 1])".uppercased()
    }

    /// 1 → «скидка», 3 → «скидки», 5 → «скидок»
    static func plural(_ n: Int, _ one: String, _ few: String, _ many: String) -> String {
        let m10 = n % 10, m100 = n % 100
        if m10 == 1 && m100 != 11 { return one }
        if (2...4).contains(m10) && !(12...14).contains(m100) { return few }
        return many
    }

    static func pad(_ n: Int64, _ width: Int = 6) -> String {
        let s = String(n)
        return s.count >= width ? s : String(repeating: "0", count: width - s.count) + s
    }

    /// «12 мин назад» / «3 ч назад» / «24.09»
    static func ago(_ d: Date?) -> String {
        guard let d else { return "" }
        let min = max(0, Int(Date().timeIntervalSince(d) / 60))
        if min < 1 { return "только что" }
        if min < 60 { return "\(min) мин назад" }
        let h = min / 60
        if h < 24 { return "\(h) ч назад" }
        return ddmm(d)
    }
}

// MARK: - Предложения: скидка и цена

enum OfferMath {
    static func discountLabel(_ o: JSON) -> String {
        let v = o.discount_value.num
        guard v > 0 else { return "" }
        return o.discount_type.str == "percentage" ? "−\(Fmt.num(v))%" : "−\(Fmt.num(v))\u{00A0}₽"
    }

    static func price(_ o: JSON) -> Double {
        let base = o.base_price.num
        let v = o.discount_value.num
        return max(0, o.discount_type.str == "percentage" ? base * (1 - v / 100) : base - v)
    }

    static func saving(_ o: JSON) -> Double { max(0, o.base_price.num - price(o)) }

    /// Сколько бонусами можно списать (процент от цены со скидкой, но не больше, чем есть).
    static func maxBonus(_ o: JSON, available: Double) -> Double {
        guard o.bonus_allowed.bool else { return 0 }
        let cap = (price(o) * o.max_bonus_percent.num / 100).rounded(.down)
        return max(0, min(available.rounded(.down), cap))
    }
}
