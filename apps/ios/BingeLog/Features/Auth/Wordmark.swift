import SwiftUI

/// Der Schriftzug: das Logo über dem Namen.
struct Wordmark: View {
    var markSize: CGFloat = 72

    var body: some View {
        VStack(spacing: 4) {
            Image("LogoMark")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: markSize, height: markSize)
                // Das Logo bringt seine Farben selbst mit
                // (`template-rendering-intent: original`). Als Schablone
                // gerendert verlöre es sein Schwarz.
                .accessibilityHidden(true)

            Text("BingeLog")
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .foregroundStyle(Theme.primary)
                .accessibilityLabel("BingeLog")
        }
    }
}
