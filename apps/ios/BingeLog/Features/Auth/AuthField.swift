import SwiftUI

/// Ein Eingabefeld mit Symbol, wie im Entwurf.
///
/// Beim Passwort mit Auge zum Aufdecken. Das ist kein Schmuck: wer sein
/// Passwort auf einem Telefon tippt, vertippt sich, und die Alternative
/// ist ein zweiter Versuch mit derselben Unsicherheit.
struct AuthField: View {
    let symbol: String
    let placeholder: String
    @Binding var text: String
    var isSecure = false
    var contentType: UITextContentType?
    var keyboard: UIKeyboardType = .default

    @State private var isRevealed = false

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .foregroundStyle(Theme.muted)
                .frame(width: 20)

            Group {
                if isSecure && !isRevealed {
                    SecureField("", text: $text, prompt: prompt)
                } else {
                    TextField("", text: $text, prompt: prompt)
                }
            }
            .textContentType(contentType)
            .keyboardType(keyboard)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .foregroundStyle(Theme.foreground)

            if isSecure {
                Button {
                    isRevealed.toggle()
                } label: {
                    Image(systemName: isRevealed ? "eye.slash" : "eye")
                        .foregroundStyle(Theme.muted)
                }
                .accessibilityLabel(isRevealed ? "Passwort verbergen" : "Passwort anzeigen")
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1)
        )
    }

    private var prompt: Text {
        Text(placeholder).foregroundColor(Theme.muted)
    }
}

/// Der große Knopf in Gold.
struct PrimaryButton: View {
    let title: String
    /// Gesperrt, weil noch etwas fehlt — nicht, weil gerade etwas läuft.
    /// Die beiden auseinanderzuhalten ist kein Detail: ein Knopf, der
    /// "Wird geprüft" heißt, weil das Feld leer ist, erzählt etwas
    /// Falsches.
    var isDisabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.headline)
                .foregroundStyle(Theme.onPrimary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Theme.primary, in: RoundedRectangle(cornerRadius: 12))
        }
        .disabled(isDisabled)
        .opacity(isDisabled ? 0.45 : 1)
    }
}
