import Foundation
import SwiftUI

/// Alle Repositories an einer Stelle, in der Umgebung.
///
/// Vorher reichte jede Ansicht die durch, die ihre Kinder brauchten.
/// Bei einer Filmzeile im Feed waren das drei Argumente durch fünf
/// verschachtelte Strukturen — und beim Hinzufügen eines vierten hat
/// mich das zweimal einen Übersetzungsfehler gekostet.
///
/// **Nur die Blätter lesen hier.** `FilmDetailView` und `ProfileView`
/// sind von überall erreichbar, deshalb holen sie sich, was sie
/// brauchen, statt es gereicht zu bekommen. Alle anderen Ansichten
/// bekommen ihre Abhängigkeiten weiterhin im Initialisierer: dort ist
/// sichtbar, wovon sie abhängen, und das ist es wert.
@Observable
@MainActor
final class Repositories {
    let films: FilmRepository
    let discover: DiscoverRepository
    let lazyFilms: LazyFilmRepository
    let details: FilmDetailRepository
    let entries: FilmEntryRepository
    let profilePages: ProfilePageRepository
    let profileEdits: ProfileEditRepository
    let reports: ReportRepository
    let lists: ListRepository
    let imports: ImportRepository

    init(
        films: FilmRepository, discover: DiscoverRepository, lazyFilms: LazyFilmRepository,
        details: FilmDetailRepository, entries: FilmEntryRepository,
        profilePages: ProfilePageRepository, profileEdits: ProfileEditRepository,
        reports: ReportRepository, lists: ListRepository, imports: ImportRepository
    ) {
        self.films = films
        self.discover = discover
        self.lazyFilms = lazyFilms
        self.details = details
        self.entries = entries
        self.profilePages = profilePages
        self.profileEdits = profileEdits
        self.reports = reports
        self.lists = lists
        self.imports = imports
    }

    static func live(backend: Backend) -> Repositories {
        Repositories(
            films: LiveFilmRepository(backend: backend),
            discover: LiveDiscoverRepository(backend: backend),
            lazyFilms: LiveLazyFilmRepository(backend: backend),
            details: LiveFilmDetailRepository(backend: backend),
            entries: LiveFilmEntryRepository(backend: backend),
            profilePages: LiveProfilePageRepository(backend: backend),
            profileEdits: LiveProfileEditRepository(backend: backend),
            reports: LiveReportRepository(backend: backend),
            lists: LiveListRepository(backend: backend),
            imports: LiveImportRepository(backend: backend)
        )
    }
}
