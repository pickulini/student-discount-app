import CoreLocation

/// Где я: для «Популярное рядом» и расстояний до мест. Спрашиваем разрешение
/// только по кнопке «Где я?» — как на сайте.
@MainActor
final class LocationProvider: NSObject, ObservableObject, CLLocationManagerDelegate {
    static let shared = LocationProvider()

    @Published var location: CLLocation?
    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        if [.authorizedWhenInUse, .authorizedAlways].contains(manager.authorizationStatus) {
            manager.requestLocation()
        }
    }

    func request() {
        switch manager.authorizationStatus {
        case .notDetermined: manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways: manager.requestLocation()
        default: break
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
        Task { @MainActor in
            if [.authorizedWhenInUse, .authorizedAlways].contains(m.authorizationStatus) { m.requestLocation() }
        }
    }

    nonisolated func locationManager(_ m: CLLocationManager, didUpdateLocations locs: [CLLocation]) {
        Task { @MainActor in self.location = locs.last }
    }

    nonisolated func locationManager(_ m: CLLocationManager, didFailWithError error: Error) {}

    /// Расстояние до места из ответа API (latitude/longitude), метры.
    func distance(to o: JSON) -> Double? {
        guard let me = location, let lat = o.latitude.double, let lng = o.longitude.double, lat != 0 || lng != 0 else { return nil }
        return me.distance(from: CLLocation(latitude: lat, longitude: lng))
    }

    static func format(_ m: Double) -> String {
        m < 1000 ? "\(Int((m / 10).rounded() * 10)) м" : String(format: "%.1f км", m / 1000).replacingOccurrences(of: ".", with: ",")
    }
}
