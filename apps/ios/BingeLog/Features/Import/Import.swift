import Foundation
import Supabase

/// Wie weit ein Import ist.
nonisolated enum ImportStatus: String, Decodable, Sendable {
    case uploaded, analyzing, ready, importing
    case completed, completedWithErrors = "completed_with_errors"
    case failed, cancelled
}

/// Ein Importstapel.
nonisolated struct ImportBatch: Decodable, Identifiable, Sendable {
    let id: UUID
    let status: ImportStatus
    let totalItems: Int
    let processedItems: Int
    let successfulItems: Int
    let failedItems: Int
    let filmsKnown: Int
    let filmsNew: Int
    let error: String?

    var progress: Double {
        guard totalItems > 0 else { return 0 }
        return min(1, Double(processedItems) / Double(totalItems))
    }

    enum CodingKeys: String, CodingKey {
        case id, status, error
        case totalItems = "total_items"
        case processedItems = "processed_items"
        case successfulItems = "successful_items"
        case failedItems = "failed_items"
        case filmsKnown = "films_known"
        case filmsNew = "films_new"
    }
}

/// Was die Vorschau sagt.
nonisolated struct ImportPreview: Decodable, Equatable, Sendable {
    let total: Int
    let filmsKnown: Int
    let filmsNew: Int
    let ratings: Int
    let diary: Int
    let reviews: Int
    let watchlist: Int
    let needsReview: Int

    enum CodingKeys: String, CodingKey {
        case total, ratings, diary, reviews, watchlist
        case filmsKnown = "films_known"
        case filmsNew = "films_new"
        case needsReview = "needs_review"
    }
}

/// Wie weit ein Durchlauf gekommen ist.
nonisolated struct ImportStep: Decodable, Equatable, Sendable {
    init(done: Bool, remaining: Int, imported: Int, failed: Int, needsReview: Int) {
        self.done = done
        self.remaining = remaining
        self.imported = imported
        self.failed = failed
        self.needsReview = needsReview
    }

    let done: Bool
    let remaining: Int
    let imported: Int
    let failed: Int
    let needsReview: Int

    enum CodingKeys: String, CodingKey {
        case done, remaining, imported, failed
        case needsReview = "needs_review"
    }
}

/// Warum ein Import nicht ging.
///
/// **Die Datenquelle wird nicht genannt** — der Nutzer soll nicht
/// erfahren, woher fehlende Filme kommen, sondern nur, dass sie
/// hinzugefügt werden.
nonisolated enum ImportProblem: Error, Equatable, Sendable {
    case notSignedIn
    case tooLarge
    case badZip
    case nothingFound
    case uploadFailed
    case offline
    case serverUnreachable

    var message: String {
        switch self {
        case .notSignedIn: return "Melde dich an."
        case .tooLarge: return "Die Datei ist zu groß. Höchstens 25 MB."
        case .badZip:
            return "Das sieht nicht nach einem Letterboxd-Export aus. "
                + "Lade das ZIP hoch, so wie du es bekommen hast."
        case .nothingFound: return "In der Datei war nichts zu importieren."
        case .uploadFailed: return "Die Datei ließ sich nicht hochladen."
        case .offline: return "Keine Internetverbindung."
        case .serverUnreachable:
            return "Der Import ist gerade nicht erreichbar. Versuch es später noch einmal."
        }
    }

    static func from(reason: String?) -> ImportProblem {
        switch reason {
        case "bad_zip": return .badZip
        case "nothing_found": return .nothingFound
        case "upload_missing": return .uploadFailed
        default: return .serverUnreachable
        }
    }

    static func from(error: Error) -> ImportProblem {
        let code = (error as NSError).code
        let offline = [
            NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost,
            NSURLErrorDataNotAllowed,
        ]
        return offline.contains(code) ? .offline : .serverUnreachable
    }
}

/// Einen Letterboxd-Export einlesen.
protocol ImportRepository: Sendable {
    /// Legt den Stapel an, lädt die Datei hoch und analysiert sie.
    /// **Ändert dabei nichts am Konto.**
    func analyse(zip: Data) async -> Result<(UUID, ImportPreview), ImportProblem>
    /// Arbeitet eine Scheibe ab. So oft rufen, bis `done`.
    func step(batch: UUID) async -> Result<ImportStep, ImportProblem>
    func batch(_ id: UUID) async -> ImportBatch?
    func cancel(_ id: UUID) async
}

struct LiveImportRepository: ImportRepository {
    let backend: Backend

    /// Dieselbe Grenze wie am Eimer. Hier, damit der Nutzer sie vor dem
    /// Hochladen sieht und nicht danach.
    static let sizeLimit = 26_214_400

    nonisolated private struct NewBatch: Encodable { let user_id: String }
    nonisolated private struct Call: Encodable {
        let batchId: String
        let mode: String
    }
    nonisolated private struct CreatedBatch: Decodable { let id: UUID }
    nonisolated private struct Reason: Decodable { let error: String? }

    func analyse(zip: Data) async -> Result<(UUID, ImportPreview), ImportProblem> {
        guard let user = backend.client.auth.currentUser else { return .failure(.notSignedIn) }
        guard zip.count <= Self.sizeLimit else { return .failure(.tooLarge) }

        // Erst der Stapel: seine Id ist der Dateiname, und der Ordner
        // ist die Benutzer-Id — genau das prüft die Policy am Eimer.
        let created: [CreatedBatch]? = try? await backend.client
            .from("import_batches")
            .insert(NewBatch(user_id: user.id.uuidString))
            .select("id")
            .execute()
            .value

        guard let batch = created?.first else { return .failure(.uploadFailed) }

        do {
            try await backend.client.storage
                .from("imports")
                .upload(
                    "\(user.id.uuidString.lowercased())/\(batch.id.uuidString.lowercased()).zip",
                    data: zip,
                    options: FileOptions(contentType: "application/zip")
                )
        } catch {
            return .failure(.uploadFailed)
        }

        do {
            let preview: ImportPreview = try await backend.client.functions.invoke(
                "letterboxd-import",
                options: FunctionInvokeOptions(
                    body: Call(batchId: batch.id.uuidString, mode: "analyse"))
            )
            return .success((batch.id, preview))
        } catch {
            // Die Function meldet den Grund im Rumpf; ohne ihn bleibt
            // nur, dass sie nicht erreichbar war.
            if let reason = try? await reasonFor(batch.id, mode: "analyse") {
                return .failure(.from(reason: reason))
            }
            return .failure(ImportProblem.from(error: error))
        }
    }

    func step(batch: UUID) async -> Result<ImportStep, ImportProblem> {
        do {
            let step: ImportStep = try await backend.client.functions.invoke(
                "letterboxd-import",
                options: FunctionInvokeOptions(body: Call(batchId: batch.uuidString, mode: "run"))
            )
            return .success(step)
        } catch {
            return .failure(ImportProblem.from(error: error))
        }
    }

    func batch(_ id: UUID) async -> ImportBatch? {
        let rows: [ImportBatch]? = try? await backend.client
            .from("import_batches")
            .select(
                "id, status, total_items, processed_items, successful_items, "
                    + "failed_items, films_known, films_new, error"
            )
            .eq("id", value: id)
            .execute()
            .value
        return rows?.first
    }

    /// Ein abgebrochener Import bleibt nicht als halber stehen.
    func cancel(_ id: UUID) async {
        try? await backend.client.from("import_batches").delete().eq("id", value: id).execute()
    }

    private func reasonFor(_ id: UUID, mode: String) async throws -> String? {
        // Der Stapel trägt den Grund, wenn die Function ihn dort
        // hinterlegt hat.
        await batch(id)?.error
    }
}
