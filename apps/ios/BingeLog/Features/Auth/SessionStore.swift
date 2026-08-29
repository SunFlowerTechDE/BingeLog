import Foundation
import Observation

/// Wer angemeldet ist, für die ganze App.
///
/// `@Observable` statt `ObservableObject` (M5 5.2): ab iOS 17 verfolgt
/// SwiftUI damit einzelne Eigenschaften statt des ganzen Objekts, und
/// eine Ansicht zeichnet nur neu, wenn sich das ändert, was sie liest.
@Observable
@MainActor
final class SessionStore {
    private(set) var userID: UUID?
    private(set) var isLoading = true
    var problem: String?

    private let auth: AuthRepository

    init(auth: AuthRepository) {
        self.auth = auth
    }

    var isSignedIn: Bool { userID != nil }

    func restore() async {
        userID = await auth.currentUserID()
        isLoading = false
    }

    func signIn(email: String, password: String) async {
        problem = nil
        do {
            try await auth.signIn(email: email, password: password)
            userID = await auth.currentUserID()
        } catch {
            // Siehe SearchViewModel: durch das Protokoll gerufen kommt
            // der Fehler untypisiert an.
            problem = BackendError.from(error).message
        }
    }

    func signOut() async {
        await auth.signOut()
        userID = nil
    }
}
