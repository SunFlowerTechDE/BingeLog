import SwiftUI

/// Der Verfasser eines Beitrags, dessen Konto gelöscht ist.
///
/// Bewertung und Text bleiben stehen — beides ist eine Aussage über
/// einen Film, und der Film steht weiter da. Was geht, ist der Name:
/// statt seiner steht „Konto gelöscht", und es führt kein Weg mehr auf
/// ein Profil, das es nicht gibt.
///
/// Das Symbol ist die **durchgestrichene** Silhouette, nicht der
/// Mülleimer. Ein Mülleimer neben einer Rezension hieße „dieser Beitrag
/// wurde gelöscht", und genau das stimmt hier nicht.
struct DeletedAccountLabel: View {
    var size: CGFloat = 16

    var body: some View {
        HStack(spacing: 5) {
            Image("profile_delete")
                .resizable()
                .scaledToFit()
                .frame(width: size, height: size)
                .opacity(0.8)

            Text("Konto gelöscht")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Theme.muted)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Konto gelöscht")
    }
}
