import SwiftUI

/// Der letzte Schritt der Einrichtung.
///
/// Wer von einer anderen Plattform kommt, hat oft Jahre an Bewertungen
/// dabei. Ihn hier zu fragen ist der Unterschied zwischen „ich fange
/// bei null an" und „meine Filmgeschichte ist schon da" — und daran
/// hängt, ob er bleibt.
///
/// **Mit einem Weg daran vorbei.** Wer nichts mitbringt, soll nicht an
/// einer Frage hängenbleiben, die ihn nichts angeht.
struct ImportOfferView: View {
    /// Wird gerufen, wenn die Frage beantwortet ist — so oder so.
    let onDone: () -> Void

    @State private var isImporting = false
    @State private var isChecking = false

    @Environment(Repositories.self) private var repos

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                Spacer()

                Image(systemName: "square.and.arrow.down")
                    .font(.system(size: 44, weight: .light))
                    .foregroundStyle(Theme.primary.opacity(0.7))

                Text("Schon Filme bewertet?")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(Theme.foreground)

                Text(
                    "Wenn du von Letterboxd kommst, kannst du deine bisherige Filmhistorie "
                        + "übernehmen — Bewertungen, Tagebuch, Rezensionen und Watchlist."
                )
                .font(.callout)
                .foregroundStyle(Theme.muted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 340)

                Spacer()

                Button {
                    isImporting = true
                } label: {
                    Text("Von Letterboxd importieren")
                        .font(.headline)
                        .foregroundStyle(Theme.onPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(Theme.primary, in: RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)

                // Für alle, die nichts mitbringen. Ohne diesen Weg
                // wäre der Bildschirm für sie eine Sackgasse mit einem
                // "Später" darunter.
                Button {
                    isChecking = true
                } label: {
                    Text("Stattdessen Geschmackscheck")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.primary)
                }
                .buttonStyle(.plain)

                Button("Später", action: onDone)
                    .font(.subheadline)
                    .foregroundStyle(Theme.muted)

                Text("Du findest beides jederzeit wieder in den Einstellungen.")
                    .font(.caption2)
                    .foregroundStyle(Theme.quiet)
                    .multilineTextAlignment(.center)
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.background)
            .navigationDestination(isPresented: $isImporting) {
                ImportView()
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            // Der Import läuft im Hintergrund weiter —
                            // hier festzuhängen wäre unnötig.
                            Button("Fertig", action: onDone)
                        }
                    }
            }
            .navigationDestination(isPresented: $isChecking) {
                TasteView(taste: repos.taste, entries: repos.entries)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Fertig", action: onDone)
                        }
                    }
            }
        }
    }
}
