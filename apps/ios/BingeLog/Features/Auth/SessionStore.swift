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
    private(set) var username: String?
    private(set) var isLoading = true
    var problem: String?
    /// Nach der Registrierung: die Adresse muss noch bestätigt werden.
    var awaitingConfirmation = false

    private let auth: AuthRepository
    private let profiles: ProfileRepository

    init(auth: AuthRepository, profiles: ProfileRepository) {
        self.auth = auth
        self.profiles = profiles
    }

    var isSignedIn: Bool { userID != nil }

    /// Angemeldet, aber noch ohne Namen.
    ///
    /// Ein Konto und ein Profil sind zweierlei. Hier zu zeigen „du bist
    /// nicht angemeldet" ergäbe eine App, die angemeldet ist und
    /// abgemeldet aussieht — derselbe Fehler wie im Web, dort behoben.
    var needsUsername: Bool { userID != nil && username == nil }

    func restore() async {
        userID = await auth.currentUserID()
        if userID != nil { username = await profiles.currentUsername() }
        isLoading = false
    }

    func signIn(email: String, password: String) async {
        problem = nil
        do {
            try await auth.signIn(email: email, password: password)
            userID = await auth.currentUserID()
            if userID != nil { username = await profiles.currentUsername() }
        } catch {
            // Siehe SearchViewModel: durch das Protokoll gerufen kommt
            // der Fehler untypisiert an.
            problem = BackendError.from(error).message
        }
    }

    func signUp(email: String, password: String) async {
        problem = nil
        do {
            let needsConfirmation = try await auth.signUp(email: email, password: password)
            awaitingConfirmation = needsConfirmation
            if !needsConfirmation {
                userID = await auth.currentUserID()
                username = await profiles.currentUsername()
            }
        } catch {
            problem = BackendError.from(error).message
        }
    }

    func chooseUsername(_ name: String) async -> Bool {
        problem = nil
        do {
            try await profiles.chooseUsername(name)
            username = await profiles.currentUsername()
            return username != nil
        } catch {
            let failure = BackendError.from(error)
            if case .other(let code) = failure, code == "name_taken" {
                problem = "Den Namen hat schon jemand. Such dir einen anderen."
            } else if case .other(let code) = failure, code == "bad_username" {
                problem = "Drei bis zwanzig Zeichen, nur Kleinbuchstaben, Ziffern und _."
            } else {
                problem = failure.message
            }
            return false
        }
    }

    func signOut() async {
        await auth.signOut()
        userID = nil
        username = nil
        awaitingConfirmation = false
    }
}
