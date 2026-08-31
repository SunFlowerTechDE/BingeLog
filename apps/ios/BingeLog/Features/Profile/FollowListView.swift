import Foundation
import Supabase
import SwiftUI

/// Wer folgt, und wem gefolgt wird.
nonisolated struct FollowEntry: Decodable, Identifiable, Sendable {
    let id: UUID
    let username: String
    let displayName: String?
    let avatarPath: String?

    var title: String { displayName ?? username }

    enum CodingKeys: String, CodingKey {
        case id, username
        case displayName = "display_name"
        case avatarPath = "avatar_path"
    }
}

extension LiveProfilePageRepository {
    nonisolated private struct FollowerRow: Decodable { let profiles: FollowEntry }

    /// Wer diesem Profil folgt beziehungsweise wem es folgt.
    ///
    /// **Über den Join, nicht über zwei Anfragen.** Und was zurückkommt,
    /// entscheidet die Policy auf `follows` und `profiles`.
    func followers(of id: UUID, incoming: Bool, limit: Int = 100) async -> [FollowEntry] {
        // Bei „wer folgt mir" hängt das Profil am Folgenden, bei „wem
        // folge ich" am Gefolgten. Zwei Spalten, dieselbe Tabelle.
        let column = incoming ? "follower_id" : "followee_id"
        let filter = incoming ? "followee_id" : "follower_id"

        let rows: [FollowerRow]? = try? await backend.client
            .from("follows")
            .select("profiles!follows_\(column)_fkey(id, username, display_name, avatar_path)")
            .eq(filter, value: id)
            .limit(limit)
            .execute()
            .value
        return (rows ?? []).map(\.profiles)
    }
}

/// Die Liste hinter einer der beiden Zahlen.
struct FollowListView: View {
    let profileID: UUID
    let incoming: Bool
    let avatarBase: URL?

    @Environment(Repositories.self) private var repos
    @State private var entries: [FollowEntry] = []
    @State private var isLoading = true

    var body: some View {
        List(entries) { entry in
            NavigationLink {
                ProfileView(username: entry.username)
            } label: {
                HStack(spacing: 12) {
                    Avatar(path: entry.avatarPath, base: avatarBase)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(entry.title)
                            .foregroundStyle(Theme.foreground)
                        if entry.displayName != nil {
                            Text("@\(entry.username)")
                                .font(.caption2)
                                .foregroundStyle(Theme.quiet)
                        }
                    }
                }
            }
            .listRowBackground(Theme.card)
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .overlay {
            if isLoading {
                ProgressView()
            } else if entries.isEmpty {
                ContentUnavailableView(
                    incoming ? "Noch niemand" : "Folgt niemandem",
                    systemImage: "person.2",
                    description: Text(
                        incoming ? "Diesem Profil folgt bisher niemand." : "Noch keine Auswahl.")
                )
            }
        }
        .navigationTitle(incoming ? "Follower" : "Folgt")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if let live = repos.profilePages as? LiveProfilePageRepository {
                entries = await live.followers(of: profileID, incoming: incoming)
            }
            isLoading = false
        }
    }
}

/// Ein rundes Profilbild.
struct Avatar: View {
    let path: String?
    let base: URL?
    var size: CGFloat = 32

    var body: some View {
        Group {
            if let path, let base {
                AsyncImage(url: base.appendingPathComponent(path)) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    Circle().fill(Theme.card)
                }
            } else {
                Circle().fill(Theme.card)
                    .overlay {
                        Image(systemName: "person")
                            .font(.caption)
                            .foregroundStyle(Theme.quiet)
                    }
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }
}
