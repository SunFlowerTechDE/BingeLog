import SwiftUI

/// Anmelden.
///
/// Aufbau nach dem Entwurf vom 30.08.2026: Plakatwand, Schriftzug,
/// Begrüßung, zwei Felder mit Symbolen, Passwort-vergessen, der goldene
/// Knopf, dann der Weg zur Registrierung.
///
/// **Ohne die beiden Fremdanmeldungen.** Sie stehen im Entwurf, brauchen
/// aber Voraussetzungen, die es noch nicht gibt — siehe
/// `docs/betrieb/ios-projekt.md`. Ein Knopf, der nichts tut, ist
/// schlechter als keiner.
struct SignInView: View {
    @Environment(SessionStore.self) private var session

    let films: FilmRepository
    let profiles: ProfileRepository

    @State private var email = ""
    @State private var password = ""
    @State private var isWorking = false
    @State private var showsRegistration = false
    @State private var showsReset = false
    @State private var wall: [Film] = []

    var body: some View {
        ZStack(alignment: .top) {
            Theme.background.ignoresSafeArea()
            PosterWall(films: wall).ignoresSafeArea(edges: .top)

            ScrollView {
                VStack(spacing: 24) {
                    Wordmark().padding(.top, 150)

                    VStack(spacing: 8) {
                        Text("Willkommen zurück")
                            .font(.title.weight(.semibold))
                            .foregroundStyle(Theme.foreground)
                        Text("Melde dich an, um deine Filme, Bewertungen und Watchlist zu verwalten.")
                            .font(.subheadline)
                            .foregroundStyle(Theme.muted)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.horizontal, 8)

                    VStack(spacing: 12) {
                        AuthField(
                            symbol: "envelope",
                            placeholder: "E-Mail",
                            text: $email,
                            contentType: .emailAddress,
                            keyboard: .emailAddress
                        )
                        AuthField(
                            symbol: "lock",
                            placeholder: "Passwort",
                            text: $password,
                            isSecure: true,
                            contentType: .password
                        )

                        HStack {
                            Spacer()
                            Button("Passwort vergessen?") {
                                session.problem = nil
                                showsReset = true
                            }
                            .font(.footnote)
                            .foregroundStyle(Theme.primary)
                        }
                    }

                    if let problem = session.problem {
                        Text(problem)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    PrimaryButton(
                        title: isWorking ? "Wird geprüft" : "Anmelden",
                        isDisabled: isWorking || email.isEmpty || password.isEmpty
                    ) {
                        Task {
                            isWorking = true
                            await session.signIn(email: email, password: password)
                            isWorking = false
                        }
                    }

                    HStack(spacing: 4) {
                        Text("Noch kein Konto?").foregroundStyle(Theme.muted)
                        Button("Registrieren") {
                            session.problem = nil
                            showsRegistration = true
                        }
                        .foregroundStyle(Theme.primary)
                    }
                    .font(.footnote)
                    .padding(.top, 4)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 40)
            }
        }
        .task {
            // Zierde: schlägt es fehl, bleibt die Wand leer und der
            // Bildschirm steht trotzdem.
            wall = await films.wellKnownWithArtwork(limit: 12)
        }
        .sheet(isPresented: $showsRegistration) { RegisterView(films: films, profiles: profiles) }
        .sheet(isPresented: $showsReset) { PasswordResetView(email: email) }
    }
}
