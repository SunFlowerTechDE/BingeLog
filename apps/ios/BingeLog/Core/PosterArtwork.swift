import Foundation
import SwiftUI
import UIKit
import WebKit

/// Was hinter einem Plakat steckt.
///
/// Zwei Faelle, und sie sind wirklich verschieden: TheTVDB liefert ein
/// Bild, die prozedurale Karte ein SVG. `AsyncImage` kann nur das eine —
/// deshalb blieb die Karte auf dem iPhone bisher leer.
enum PosterArtwork: Equatable, Sendable {
    /// Ein echtes Plakat von TheTVDB. **Verlinkt, nie gespiegelt**
    /// (docs/legal/thetvdb-lizenz.md).
    case photograph(UIImage)
    /// Die prozedurale Karte, so wie der Server sie gezeichnet hat.
    ///
    /// Als Text und nicht nachgebaut: dieselbe Karte muss auf Web,
    /// iPhone und Android gleich aussehen, und dreimal gezeichnet
    /// sieht sie dreimal anders aus (ADR-012).
    case drawing(String)

    /// Die Grundfarbe der Karte.
    ///
    /// Aus der Antwort des Servers gelesen, nicht nachgerechnet. Das
    /// erste `<rect>` im SVG ist der Grund — so erzeugt es
    /// `renderPosterSVG`, und so kommt es an.
    var ground: Color {
        switch self {
        case .photograph(let image):
            return Color(uiColor: image.averageColour ?? .black)
        case .drawing(let svg):
            return PosterArtwork.firstColour(in: svg, attribute: "fill") ?? Theme.card
        }
    }

    /// Die Schmuckfarbe, für die Splitter beim Zusammensetzen.
    var accent: Color {
        switch self {
        case .photograph(let image):
            return Color(uiColor: image.averageColour?.lightened() ?? .darkGray)
        case .drawing(let svg):
            return PosterArtwork.firstColour(in: svg, attribute: "stroke") ?? Theme.border
        }
    }

    /// `attribut="#rrggbb"`, das erste Vorkommen.
    ///
    /// Als eigene Funktion, weil sich ein SVG schlecht pruefen laesst,
    /// diese Regel aber gut.
    static func firstColour(in svg: String, attribute: String) -> Color? {
        guard
            let range = svg.range(
                of: "\(attribute)=\"#[0-9a-fA-F]{6}\"", options: .regularExpression)
        else { return nil }

        // Hinten das Anfuehrungszeichen weg, dann die sechs Stellen.
        // `suffix(7).dropFirst()` liess das Zeichen stehen, womit jede
        // Farbe still auf die Ersatzfarbe fiel.
        let hex = svg[range].dropLast().suffix(6)
        guard let value = UInt32(hex, radix: 16) else { return nil }
        return Color(hex: value)
    }
}

extension UIImage {
    /// Eine Farbe für das ganze Bild, über einen Punkt gemittelt.
    var averageColour: UIColor? {
        guard let input = CIImage(image: self) else { return nil }
        let filter = CIFilter(name: "CIAreaAverage", parameters: [
            kCIInputImageKey: input,
            kCIInputExtentKey: CIVector(cgRect: input.extent),
        ])
        guard let output = filter?.outputImage else { return nil }

        var pixel = [UInt8](repeating: 0, count: 4)
        CIContext(options: [.workingColorSpace: NSNull()]).render(
            output,
            toBitmap: &pixel,
            rowBytes: 4,
            bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
            format: .RGBA8,
            colorSpace: nil
        )

        return UIColor(
            red: CGFloat(pixel[0]) / 255,
            green: CGFloat(pixel[1]) / 255,
            blue: CGFloat(pixel[2]) / 255,
            alpha: 1
        )
    }
}

extension UIColor {
    /// Etwas heller, für die Splitter.
    func lightened() -> UIColor {
        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        guard getHue(&h, saturation: &s, brightness: &b, alpha: &a) else { return self }
        return UIColor(hue: h, saturation: s * 0.8, brightness: min(1, b + 0.28), alpha: a)
    }
}

/// Holt das Plakat — Bild oder Zeichnung.
enum PosterLoader {
    static let webBase = URL(string: "https://bingelog.eu")!

    static func load(for film: Film) async -> PosterArtwork? {
        guard let address = film.posterAddress(webBase: webBase) else { return nil }

        guard let (data, response) = try? await URLSession.shared.data(from: address),
            let http = response as? HTTPURLResponse, http.statusCode == 200
        else { return nil }

        // Nach dem Inhaltstyp entschieden und nicht nach `poster_source`:
        // was ankommt, weiss die Antwort besser als der Katalog.
        let kind = http.value(forHTTPHeaderField: "Content-Type") ?? ""
        if kind.contains("svg") {
            guard let text = String(data: data, encoding: .utf8) else { return nil }
            return .drawing(text)
        }

        guard let image = UIImage(data: data) else { return nil }
        return .photograph(image)
    }
}

/// Zeigt ein SVG.
///
/// Ueber WebKit, weil `UIImage` kein SVG kann. Gezeichnet wird nichts
/// selbst — angezeigt wird, was der Server geschickt hat.
struct SVGView: UIViewRepresentable {
    let svg: String

    func makeUIView(context: Context) -> WKWebView {
        let view = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        view.isOpaque = false
        view.backgroundColor = .clear
        view.scrollView.isScrollEnabled = false
        view.scrollView.backgroundColor = .clear
        view.isUserInteractionEnabled = false
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        guard context.coordinator.shown != svg else { return }
        context.coordinator.shown = svg

        // Das SVG fuellt die Flaeche und bringt keinen eigenen Rand mit.
        let page = """
            <!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
            <style>html,body{margin:0;padding:0;background:transparent;height:100%}
            svg{display:block;width:100%;height:100%}</style>\(svg)
            """
        view.loadHTMLString(page, baseURL: nil)
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator {
        var shown: String?
    }
}

/// Ein Plakat in fester Groesse — Bild oder Karte, je nachdem.
struct PosterImage: View {
    let artwork: PosterArtwork?

    var body: some View {
        switch artwork {
        case .photograph(let image):
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fill)
        case .drawing(let svg):
            SVGView(svg: svg)
        case nil:
            Rectangle().fill(Theme.card)
        }
    }
}

/// Ein Plakat in fester Größe — Bild oder prozedurale Karte.
///
/// Eine Stelle für alle Listen. Vorher stand an jeder ein eigenes
/// `AsyncImage`, und jedes davon blieb bei einer prozeduralen Karte
/// leer.
struct PosterThumbnail: View {
    let film: Film
    let width: CGFloat

    @State private var artwork: PosterArtwork?

    var body: some View {
        PosterImage(artwork: artwork)
            .frame(width: width, height: width * 1.5)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .task(id: film.wikidataID) {
                artwork = await PosterLoader.load(for: film)
            }
    }
}
