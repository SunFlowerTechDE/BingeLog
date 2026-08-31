import Foundation
import Supabase

/// Die festen Facetten.
///
/// Als Aufzählung und nicht als freier Text, denn genau darin liegt der
/// Sinn: dieselben sieben bei jedem Film, sonst lässt sich nichts
/// vergleichen. Dieselben Werte wie `facet_kind` in der Datenbank und
/// `FACET_KINDS` im Web (ADR-009).
///
/// **Facetten sind freiwillig, die Bewertung ist Pflicht.** Sie fließen
/// nie in die Gesamtbewertung ein — keine Ableitung, kein Durchschnitt
/// daraus.
enum FacetKind: String, CaseIterable, Codable, Sendable {
    case acting
    case story
    case directing
    case cinematography
    case sound
    case productionDesign = "production_design"
    case pacing

    var label: String {
        switch self {
        case .acting: return "Schauspiel"
        case .story: return "Story und Drehbuch"
        case .directing: return "Regie"
        case .cinematography: return "Bild und Kamera"
        case .sound: return "Ton und Musik"
        case .productionDesign: return "Setting und Ausstattung"
        case .pacing: return "Tempo"
        }
    }
}

/// Wie die anderen eine Facette im Schnitt bewerten.
///
/// **Erst ab fünf Stimmen.** „Schauspiel 2,0 (1 Stimme)" führt in die
/// Irre und lädt zum Kippen ein (M3, Fallstricke). Die Schwelle sitzt in
/// der materialisierten Sicht, nicht hier.
struct FacetAverage: Decodable, Identifiable, Sendable {
    let facet: FacetKind
    let average: Double
    let votes: Int

    var id: String { facet.rawValue }

    enum CodingKeys: String, CodingKey {
        case facet
        case average = "avg_score"
        case votes = "vote_count"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        facet = try c.decode(FacetKind.self, forKey: .facet)
        votes = (try? c.decode(Int.self, forKey: .votes)) ?? 0
        if let text = (try? c.decodeIfPresent(String.self, forKey: .average)) ?? nil {
            average = Double(text) ?? 0
        } else {
            average = (try? c.decode(Double.self, forKey: .average)) ?? 0
        }
    }
}

extension LiveFilmEntryRepository {
    private struct FilmArguments: Encodable { let film: String }
    private struct OwnFacetRow: Decodable { let facet: FacetKind; let score: Int }
    private struct FacetWrite: Encodable { let entry_id: String; let facet: String; let score: Int }

    /// Die eigenen Facetten zum jüngsten Eintrag.
    func ownFacets(for filmID: String) async -> [FacetKind: Int] {
        let rows: [OwnFacetRow]? = try? await backend.client
            .rpc("my_facet_ratings", params: FilmArguments(film: filmID))
            .execute()
            .value

        var out: [FacetKind: Int] = [:]
        // Die Funktion sortiert nach Eintrag absteigend; der erste Wert
        // je Facette gehört damit zum jüngsten Eintrag.
        for row in rows ?? [] where out[row.facet] == nil {
            out[row.facet] = row.score
        }
        return out
    }

    /// Wie die anderen bewerten.
    func facetAverages(for filmID: String) async -> [FacetAverage] {
        let rows: [FacetAverage]? = try? await backend.client
            .from("film_facet_averages")
            .select("facet, avg_score, vote_count")
            .eq("film_id", value: filmID)
            .execute()
            .value
        return rows ?? []
    }

    /// Ersetzt die Facetten eines Eintrags durch die übergebenen.
    ///
    /// Erst löschen, dann schreiben — dieselbe Reihenfolge wie im Web.
    /// Eine Facette, die der Nutzer zurückgenommen hat, muss auch
    /// wirklich weg sein, und ein `upsert` allein nähme sie nicht.
    func replaceFacets(entryID: UUID, with scores: [FacetKind: Int]) async {
        try? await backend.client
            .from("entry_facet_ratings")
            .delete()
            .eq("entry_id", value: entryID)
            .execute()

        let rows = scores.compactMap { facet, score -> FacetWrite? in
            guard (1...10).contains(score) else { return nil }
            return FacetWrite(
                entry_id: entryID.uuidString, facet: facet.rawValue, score: score)
        }
        guard !rows.isEmpty else { return }

        try? await backend.client.from("entry_facet_ratings").insert(rows).execute()
    }
}
