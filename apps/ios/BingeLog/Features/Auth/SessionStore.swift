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
        if userID != nil {
            username = await profiles.currentUsername()
            if username == nil { await claimPendingUsername() }
        }
        isLoading = false
    }

    /// Den bei der Registrierung gewünschten Namen einlösen.
    ///
    /// Beim Registrieren gibt es noch keine Sitzung, also auch kein
    /// Profil. Der Name liegt bis dahin in den Metadaten des Kontos und
    /// wird beim ersten Anmelden angelegt.
    ///
    /// **Schlägt es fehl, ist das kein Fehler**, sondern der Fall, dass
    /// sich in der Zwischenzeit jemand denselben Namen genommen hat.
    /// Dann greift die Namenswahl, und der Nutzer sucht sich einen
    /// anderen — statt eine Meldung zu lesen, mit der er nichts anfangen
    /// kann.
    private func claimPendingUsername() async {
        guard let wanted = await auth.pendingUsername() else { return }
        try? await profiles.chooseUsername(wanted)
        username = await profiles.currentUsername()
    }

    func signIn(email: String, password: String) async {
        problem = nil
        do {
            try await auth.signIn(email: email, password: password)
            userID = await auth.currentUserID()
            if userID != nil {
                username = await profiles.currentUsername()
                if username == nil { await claimPendingUsername() }
            }
        } catch {
            // Siehe SearchViewModel: durch das Protokoll gerufen kommt
            // der Fehler untypisiert an.
            problem = BackendError.from(error).message
        }
    }

    func signUp(email: String, password: String, username wanted: String) async {
        problem = nil
        do {
            let needsConfirmation = try await auth.signUp(
                email: email, password: password, username: wanted)
            awaitingConfirmation = needsConfirmation
            if !needsConfirmation {
                userID = await auth.currentUserID()
                username = await profiles.currentUsername()
                if username == nil { await claimPendingUsername() }
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

    /// Gibt zurück, ob die Mail ausgelöst wurde.
    ///
    /// **Die Antwort ist immer dieselbe**, ob es die Adresse gibt oder
    /// nicht. Sonst wäre das Formular eine Auskunft darüber, wer hier
    /// ein Konto hat.
    func sendPasswordReset(to email: String) async -> Bool {
        problem = nil
        do {
            try await auth.sendPasswordReset(to: email)
            return true
        } catch {
            problem = BackendError.from(error).message
            return false
        }
    }

    func signOut() async {
        await auth.signOut()
        forget()
    }

    /// Das eigene Konto löschen (Art. 17 DSGVO).
    ///
    /// Bei Erfolg dasselbe wie ein Abmelden — nur dass es nichts mehr
    /// gibt, wohin man sich anmelden könnte.
    func deleteAccount() async -> SaveOutcome {
        let ergebnis = await auth.deleteAccount()
        if case .saved = ergebnis { forget() }
        return ergebnis
    }

    private func forget() {
        userID = nil
        username = nil
        awaitingConfirmation = false
    }
}
