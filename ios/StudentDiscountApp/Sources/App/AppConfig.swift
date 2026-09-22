import Foundation

/// Базовые настройки подключения к вашему backend.
///
/// ВАЖНО: "localhost" с реального iPhone указывает на сам телефон, а не на ваш
/// сервер. Поэтому здесь нужно указать реальный адрес сервера (домен или
/// публичный IP), на котором развёрнут docker-compose.prod.yml — тот же,
/// что открывается в браузере как http://<ваш-сервер> или https://<домен>.
/// Значение можно поменять прямо в приложении на экране входа (оно
/// сохраняется в UserDefaults), поэтому менять код необязательно — но
/// разумно сразу подставить сюда адрес по умолчанию.
enum AppConfig {
    static let defaultServerURLString = "http://localhost"

    private static let storageKey = "server_base_url"

    static var serverURLString: String {
        get {
            UserDefaults.standard.string(forKey: storageKey) ?? defaultServerURLString
        }
        set {
            UserDefaults.standard.set(newValue, forKey: storageKey)
        }
    }

    static var baseURL: URL {
        URL(string: serverURLString) ?? URL(string: defaultServerURLString)!
    }
}
