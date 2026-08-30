import SwiftUI

/// Der Schriftzug.
///
/// Vorläufig aus einem Systemzeichen und Text gesetzt. Ein echtes Logo
/// gehört als Bilddatei in die Assets — bis es eins gibt, ist ein
/// sauber gesetzter Schriftzug besser als ein nachgezeichnetes, das
/// später doch ausgetauscht wird.
struct Wordmark: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "film.circle.fill")
                .font(.system(size: 46))
                .foregroundStyle(Theme.primary)

            Text("BingeLog")
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .foregroundStyle(Theme.primary)
        }
    }
}
