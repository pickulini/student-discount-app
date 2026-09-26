import XCTest

/// Проверки навигации на живом приложении (локальный сервер, тестовый пользователь).
/// Параметры передаются через окружение: TEST_RUNNER_UIT_EMAIL, TEST_RUNNER_UIT_PASSWORD, TEST_RUNNER_UIT_EVENT.
final class NavigationUITests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    /// «← Ивенты» на странице ивента с вертикальной обложкой должен возвращать к списку.
    /// Раньше невидимая часть обложки (scaledToFill) перехватывала нажатие.
    func testBackFromEventWithTallCover() throws {
        let env = ProcessInfo.processInfo.environment
        guard let email = env["UIT_EMAIL"], let password = env["UIT_PASSWORD"], let event = env["UIT_EVENT"] else {
            throw XCTSkip("нет тестовых параметров")
        }
        let app = XCUIApplication()
        app.launchArguments = ["-server_base_url", "http://localhost", "-uitest_email", email, "-uitest_password", password,
                               "-uitest_tab", "events", "-uitest_route", "event:\(event)"]
        app.launch()

        let back = app.buttons["← ИВЕНТЫ"]
        XCTAssertTrue(back.waitForExistence(timeout: 40), "нет кнопки «назад»")
        sleep(5) // обложка успевает загрузиться и лечь поверх шапки
        back.tap()
        sleep(2)
        XCTAssertFalse(app.buttons["← ИВЕНТЫ"].exists, "кнопка «назад» не сработала — всё ещё на странице ивента")
        XCTAssertTrue(app.staticTexts["ИВЕНТЫ"].waitForExistence(timeout: 10), "не вернулись к списку ивентов")
    }
}

extension NavigationUITests {
    private func launch(tab: String) throws -> XCUIApplication {
        let env = ProcessInfo.processInfo.environment
        guard let email = env["UIT_EMAIL"], let password = env["UIT_PASSWORD"] else { throw XCTSkip("нет тестовых параметров") }
        let app = XCUIApplication()
        app.launchArguments = ["-server_base_url", "http://localhost", "-uitest_email", email, "-uitest_password", password, "-uitest_tab", tab]
        app.launch()
        return app
    }

    /// Как пользователь: вкладка «Ивенты» → нажать ивент в ленте → «назад»; несколько раз подряд,
    /// в том числе после прокрутки страницы ивента и после «Может быть».
    func testBackFromEventOpenedFromList() throws {
        let app = try launch(tab: "events")
        XCTAssertTrue(app.staticTexts["ИВЕНТЫ"].waitForExistence(timeout: 40))
        sleep(4)
        let rows = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'идут'"))
        if !rows.firstMatch.waitForExistence(timeout: 20) {
            print("UITREE-BEGIN\n" + app.debugDescription + "\nUITREE-END")
            XCTFail("в ленте нет ивентов")
            return
        }
        for round in 1...4 {
            let row = rows.element(boundBy: min(round - 1, rows.count - 1))
            if !row.isHittable { app.swipeUp() }
            row.tap()
            let back = app.buttons["← ИВЕНТЫ"]
            XCTAssertTrue(back.waitForExistence(timeout: 15), "раунд \(round): страница ивента не открылась")
            sleep(3)
            if round == 2 { app.swipeUp(); sleep(1); app.swipeDown(); sleep(1) }
            if round == 3, app.buttons["Может быть"].exists { app.buttons["Может быть"].tap(); sleep(2) }
            back.tap()
            sleep(2)
            if app.buttons["← ИВЕНТЫ"].exists {
                let shot = XCTAttachment(screenshot: app.screenshot()); shot.lifetime = .keepAlways; add(shot)
                XCTFail("раунд \(round): «назад» не сработал")
                return
            }
        }
    }

    /// С главной: карточка ивента → «назад».
    func testBackFromEventOpenedFromHome() throws {
        let app = try launch(tab: "home")
        sleep(8)
        // кнопка «[ Пойду ]» на карточке ивента в ленте главной (нижняя вкладка «ИВЕНТЫ» не подходит)
        let cards = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Пойду'"))
        for _ in 0..<4 where !cards.firstMatch.exists { app.swipeUp() }
        guard cards.firstMatch.exists else { throw XCTSkip("на главной нет карточек ивентов") }
        print("HOMECARD: " + cards.firstMatch.label)
        cards.firstMatch.tap()
        let back = app.buttons["← ИВЕНТЫ"]
        if !back.waitForExistence(timeout: 15) {
            print("UITREE-BEGIN\n" + app.debugDescription + "\nUITREE-END")
            XCTFail("страница ивента не открылась")
            return
        }
        sleep(3)
        back.tap()
        sleep(2)
        XCTAssertFalse(app.buttons["← ИВЕНТЫ"].exists, "«назад» не сработал")
    }
}
