import SwiftUI

/// Passwort vergessen.
struct PasswordResetView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss

    @State private var email: String
    @State private var isWorking = false
    @State private var isSent = false

    init(email: String) {
        _email = State(initialValue: email)
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                if isSent {
                    sent
                } else {
                    form
                }
                Spacer()
            }
            .padding(24)
            .background(Theme.background)
            .navigationTitle("Passwort vergessen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
            }
        }
    }

    private var form: some View {
        Group {
            Text("Wir schicken dir einen Link, mit dem du ein neues Passwort setzen kannst.")
                .font(.subheadline)
                .foregroundStyle(Theme.muted)

            AuthField(
                symbol: "envelope",
                placeholder: "E-Mail",
                text: $email,
                contentType: .emailAddress,
                keyboard: .emailAddress
            )

            if let problem = session.problem {
                Text(problem).font(.footnote).foregroundStyle(.red)
            }

            PrimaryButton(title: isWorking ? "Wird gesendet" : "Link schicken", isDisabled: isWorking || email.isEmpty) {
                Task {
                    isWorking = true
                    isSent = await session.sendPasswordReset(to: email)
                    isWorking = false
                }
            }
        }
    }

    private var sent: some View {
        Group {
            Image(systemName: "envelope")
                .font(.largeTitle)
                .foregroundStyle(Theme.primary)

            Text("Schau in dein Postfach")
                .font(.title2.weight(.semibold))
                .foregroundStyle(Theme.foreground)

            // Bewusst ohne "falls es die Adresse gibt": das wäre
            // dieselbe Auskunft nur höflicher formuliert. Wer hier ein
            // Konto hat, geht niemanden etwas an.
            Text(
                "Wenn zu dieser Adresse ein Konto gehört, liegt gleich eine Mail darin. "
                    + "Der Link führt auf bingelog.eu, dort setzt du das neue Passwort."
            )
            .foregroundStyle(Theme.muted)

            PrimaryButton(title: "Zurück zur Anmeldung") { dismiss() }
        }
    }
}
