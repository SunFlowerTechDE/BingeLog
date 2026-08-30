import SwiftUI

/// Anmelden.
struct SignInView: View {
    @Environment(SessionStore.self) private var session

    @State private var email = ""
    @State private var password = ""
    @State private var isWorking = false
    @State private var showsRegistration = false

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Anmelden")
                    .font(.largeTitle.weight(.semibold))
                Text("Weiter mit deinem Tagebuch.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 12) {
                TextField("E-Mail", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                SecureField("Passwort", text: $password)
                    .textContentType(.password)
            }
            .textFieldStyle(.roundedBorder)

            if let problem = session.problem {
                Text(problem)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            Button {
                Task {
                    isWorking = true
                    await session.signIn(email: email, password: password)
                    isWorking = false
                }
            } label: {
                // Ohne sichtbaren Zustand hält man einen langsamen
                // Vorgang für keinen und drückt noch einmal.
                Text(isWorking ? "Wird geprüft" : "Anmelden")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(isWorking || email.isEmpty || password.isEmpty)

            HStack(spacing: 4) {
                Text("Noch kein Konto?")
                    .foregroundStyle(.secondary)
                Button("Registrieren") {
                    session.problem = nil
                    showsRegistration = true
                }
            }
            .font(.footnote)

            Spacer()
        }
        .padding(24)
        .sheet(isPresented: $showsRegistration) {
            RegisterView()
        }
    }
}
