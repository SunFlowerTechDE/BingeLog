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
    func signUp(email: String, password: String, username: String) async throws(BackendError)
        -> Bool
    /// Der bei der Registrierung gewünschte Name, aus den Metadaten.
    func pendingUsername() async -> String?
    func sendPasswordReset(to email: String) async throws(BackendError)
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
    func signUp(email: String, password: String, username: String) async throws(BackendError)
        -> Bool
    {
        do {
            // Der Name geht als Metadatum mit.
            //
            // Anlegen lässt er sich hier noch nicht: `profiles` verlangt
            // `auth.uid()`, und bei eingeschalteter Bestätigung gibt es
            // noch keine Sitzung. Also merken und beim ersten Anmelden
            // einlösen — siehe `SessionStore.claimPendingUsername`.
            let response = try await backend.client.auth.signUp(
                email: email,
                password: password,
                data: ["username": .string(username)]
            )
            return response.session == nil
        } catch {
            throw BackendError.from(error)
        }
    }

    func pendingUsername() async -> String? {
        guard let metadata = try? await backend.client.auth.session.user.userMetadata,
            case .string(let name)? = metadata["username"]
        else { return nil }
        return name
    }

    /// Die Zurücksetz-Mail auslösen.
    ///
    /// Der Link führt auf die Webseite, nicht in die App — dort steht
    /// das Formular für ein neues Passwort. Ein Deep-Link zurück ist
    /// derselbe eigene Schritt wie bei der Bestätigung (5.7).
    ///
    /// **Ohne eigenes `redirectTo`.** Dann hängt Supabase die `SITE_URL`
    /// des Projekts an, und die zeigt immer auf die Seite, die auch
    /// wirklich steht. Vorher war hier `https://bingelog.eu/...`
    /// fest verdrahtet — auf eine Seite, die es dort nicht gab, weshalb
    /// der Link am 31.08.2026 in einen 404 lief.
    func sendPasswordReset(to email: String) async throws(BackendError) {
        do {
            try await backend.client.auth.resetPasswordForEmail(email)
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
