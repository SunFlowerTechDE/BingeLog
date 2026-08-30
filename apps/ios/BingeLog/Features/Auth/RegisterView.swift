import SwiftUI

/// Ein Konto anlegen.
struct RegisterView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var password = ""
    @State private var isWorking = false

    /// Acht Zeichen, wie im Web. Kürzer nimmt Supabase ohnehin nicht an,
    /// und die Absage erst nach dem Abschicken zu zeigen wäre ein
    /// vermeidbarer Umweg.
    private var passwordLongEnough: Bool { password.count >= 8 }

    var body: some View {
        NavigationStack {
            Group {
                if session.awaitingConfirmation {
                    confirmation
                } else {
                    form
                }
            }
            .navigationTitle("Registrieren")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
            }
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Ein Konto, dann kann es losgehen.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            VStack(spacing: 12) {
                TextField("E-Mail", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                SecureField("Passwort", text: $password)
                    .textContentType(.newPassword)
            }
            .textFieldStyle(.roundedBorder)

            Text(passwordLongEnough ? " " : "Mindestens acht Zeichen.")
                .font(.footnote)
                .foregroundStyle(.secondary)

            if let problem = session.problem {
                Text(problem)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            Button {
                Task {
                    isWorking = true
                    await session.signUp(email: email, password: password)
                    isWorking = false
                }
            } label: {
                Text(isWorking ? "Wird angelegt" : "Konto anlegen")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(isWorking || email.isEmpty || !passwordLongEnough)

            Spacer()
        }
        .padding(24)
    }

    /// Nach dem Anlegen: die Adresse muss bestätigt werden.
    ///
    /// Der Link in der Mail führt in den Browser und nicht in die App.
    /// Das ist ehrlicher als ein Knopf, der hier auf etwas wartet, das
    /// nicht kommt — ein Deep-Link zurück ist ein eigener Schritt.
    private var confirmation: some View {
        VStack(alignment: .leading, spacing: 16) {
            Image(systemName: "envelope")
                .font(.largeTitle)
                .foregroundStyle(.tint)

            Text("Schau in dein Postfach")
                .font(.title2.weight(.semibold))

            Text(
                "Wir haben dir eine Mail geschickt. Bestätige die Adresse darin, "
                    + "dann kannst du dich hier anmelden."
            )
            .foregroundStyle(.secondary)

            Button("Zur Anmeldung") { dismiss() }
                .buttonStyle(.borderedProminent)
                .padding(.top, 8)

            Spacer()
        }
        .padding(24)
    }
}
