import Foundation
import Supabase

/// Anmelden, abmelden, und wer gerade angemeldet ist.
///
/// Ein Protokoll, damit Views und Modelle gegen etwas Prüfbares laufen
/// und nicht gegen das SDK (M5 5.2).
protocol AuthRepository: Sendable {
    func currentUserID() async -> UUID?
    func signIn(email: String, password: String) async throws(BackendError)
    /// Gibt zurück, ob die Adresse noch bestätigt werden muss.
    func signUp(email: String, password: String) async throws(BackendError) -> Bool
    func signOut() async
}

struct LiveAuthRepository: AuthRepository {
    let backend: Backend

    func currentUserID() async -> UUID? {
        try? await backend.client.auth.session.user.id
    }

    func signIn(email: String, password: String) async throws(BackendError) {
        do {
            try await backend.client.auth.signIn(email: email, password: password)
        } catch {
            throw BackendError.from(error)
        }
    }

    /// Registrieren.
    ///
    /// Ist die Bestätigung per Mail eingeschaltet — und das ist sie —,
    /// entsteht hier **keine Sitzung**. Der Nutzer bekommt eine Mail,
    /// bestätigt im Browser und meldet sich danach hier an. Ein
    /// Deep-Link zurück in die App wäre schöner und ist ein eigener
    /// Schritt (M5 5.7).
    func signUp(email: String, password: String) async throws(BackendError) -> Bool {
        do {
            let response = try await backend.client.auth.signUp(email: email, password: password)
            return response.session == nil
        } catch {
            throw BackendError.from(error)
        }
    }

    func signOut() async {
        // Beim Abmelden gibt es nichts zu behandeln: schlägt es fehl,
        // ist die Sitzung lokal trotzdem weg, und das ist es, was der
        // Nutzer wollte.
        try? await backend.client.auth.signOut()
    }
}
