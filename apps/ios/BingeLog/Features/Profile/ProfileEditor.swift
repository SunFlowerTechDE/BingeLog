import Foundation
import Supabase
import SwiftUI
import UIKit

/// Was beim Hochladen herauskam.
///
/// Ein eigener Typ statt `Result<String, String>`: eine Zeichenkette ist
/// kein Fehler, und der Compiler sagt das zu Recht — derselbe Griff wie
/// bei `SaveOutcome`.
nonisolated enum UploadOutcome: Equatable, Sendable {
    case uploaded(String)
    case failed(String)
}

/// Das eigene Profil ändern.
protocol ProfileEditRepository: Sendable {
    func updateProfile(displayName: String?, bio: String?) async -> SaveOutcome
    /// Gibt den neuen Pfad zurück, oder sagt warum nicht.
    func uploadAvatar(_ data: Data) async -> UploadOutcome
    func uploadBanner(_ data: Data) async -> UploadOutcome
    func setFavourite(slot: Int, film: String?) async -> SaveOutcome
}

struct LiveProfileEditRepository: ProfileEditRepository {
    let backend: Backend

    nonisolated private struct ProfileFields: Encodable {
        let display_name: String?
        let bio: String?
    }

    nonisolated private struct FavouriteRow: Encodable {
        let user_id: String
        let film_id: String
        let position: Int
    }

    func updateProfile(displayName: String?, bio: String?) async -> SaveOutcome {
        guard let user = backend.client.auth.currentUser else {
            return .failed("Melde dich an.")
        }

        let name = displayName?.trimmingCharacters(in: .whitespacesAndNewlines)
        let text = bio?.trimmingCharacters(in: .whitespacesAndNewlines)

        // Die Grenzen stehen als CHECK in der Tabelle. Hier steht
        // dieselbe Zahl, damit der Nutzer sie vor dem Abschicken sieht
        // und nicht danach.
        guard (name?.count ?? 0) <= 60 else { return .failed("Der Name ist zu lang.") }
        guard (text?.count ?? 0) <= 500 else { return .failed("Die Beschreibung ist zu lang.") }

        do {
            try await backend.client
                .from("profiles")
                .update(
                    ProfileFields(
                        display_name: (name?.isEmpty ?? true) ? nil : name,
                        bio: (text?.isEmpty ?? true) ? nil : text)
                )
                .eq("id", value: user.id)
                .execute()
            return .saved
        } catch {
            return .failed(BackendError.from(error).message)
        }
    }

    func uploadAvatar(_ data: Data) async -> UploadOutcome {
        await upload(data, into: "avatars", limit: 262_144)
    }

    func uploadBanner(_ data: Data) async -> UploadOutcome {
        await upload(data, into: "banners", limit: 409_600)
    }

    /// Hochladen und den Pfad ins Profil schreiben.
    ///
    /// **JPEG.** Der Eimer nimmt WebP und JPEG; `UIImage` schreibt kein
    /// WebP, und ein Umweg über einen Kodierer wäre eine Abhängigkeit
    /// für nichts.
    ///
    /// Der Pfad enthält die Benutzer-Id als Ordner — die Policy auf
    /// `storage.objects` prüft genau das. Ein anderer Ordner wird
    /// abgewiesen, und das ist richtig so.
    private func upload(_ data: Data, into bucket: String, limit: Int) async -> UploadOutcome {
        guard let user = backend.client.auth.currentUser else {
            return .failed("Melde dich an.")
        }
        guard data.count <= limit else {
            return .failed("Das Bild ist zu groß. Nimm ein kleineres.")
        }

        // Ein neuer Name je Bild: sonst zeigt der Browser das alte aus
        // seinem Zwischenspeicher, und es sieht aus, als sei nichts
        // passiert.
        let path = "\(user.id.uuidString.lowercased())/\(UUID().uuidString).jpg"

        do {
            try await backend.client.storage
                .from(bucket)
                .upload(path, data: data, options: FileOptions(contentType: "image/jpeg"))

            try await backend.client
                .from("profiles")
                .update([bucket == "avatars" ? "avatar_path" : "banner_path": path])
                .eq("id", value: user.id)
                .execute()

            return .uploaded(path)
        } catch {
            return .failed(BackendError.from(error).message)
        }
    }

    /// Einen Favoritenplatz setzen oder räumen.
    func setFavourite(slot: Int, film: String?) async -> SaveOutcome {
        guard (1...4).contains(slot) else { return .failed("Es gibt vier Plätze.") }
        guard let user = backend.client.auth.currentUser else {
            return .failed("Melde dich an.")
        }

        do {
            if let film {
                try await backend.client
                    .from("favourites")
                    .upsert(
                        FavouriteRow(
                            user_id: user.id.uuidString, film_id: film, position: slot),
                        onConflict: "user_id,position"
                    )
                    .execute()
            } else {
                try await backend.client
                    .from("favourites")
                    .delete()
                    .eq("user_id", value: user.id)
                    .eq("position", value: slot)
                    .execute()
            }
            return .saved
        } catch {
            return .failed(BackendError.from(error).message)
        }
    }
}

/// Ein Bild auf die Größe bringen, die der Eimer nimmt.
///
/// Als eigene Funktion, weil sich ein Bildwähler schlecht prüfen lässt,
/// die Regel dahinter aber gut: verkleinern, bis es passt, und lieber
/// stärker komprimieren als abweisen.
nonisolated enum ImagePreparation {
    /// Die Kantenlänge, auf die verkleinert wird, bevor komprimiert
    /// wird.
    static func fitting(_ size: CGSize, longestSide: CGFloat) -> CGSize {
        let longest = max(size.width, size.height)
        guard longest > longestSide, longest > 0 else { return size }
        let factor = longestSide / longest
        return CGSize(width: size.width * factor, height: size.height * factor)
    }

    /// Die Qualitätsstufen, die der Reihe nach versucht werden.
    static let qualities: [CGFloat] = [0.8, 0.65, 0.5, 0.35, 0.25]

    static func jpeg(from image: UIImage, longestSide: CGFloat, limit: Int) -> Data? {
        let target = fitting(image.size, longestSide: longestSide)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let scaled = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }

        for quality in qualities {
            if let data = scaled.jpegData(compressionQuality: quality), data.count <= limit {
                return data
            }
        }
        return nil
    }
}
