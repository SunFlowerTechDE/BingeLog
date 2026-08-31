import SwiftUI

/// Die Watchlist (M5 5.6).
struct WatchlistView: View {
    var body: some View {
        ComingSoon(
            title: "Watchlist",
            symbol: "bookmark",
            what: "Hier stehen die Filme, die du dir vorgemerkt hast. "
                + "Vormerken geht schon — auf jeder Filmseite oben rechts.",
            step: "M5 5.6"
        )
    }
}

/// Das Tagebuch (M5 5.4).
struct DiaryView: View {
    var body: some View {
        ComingSoon(
            title: "Tagebuch",
            symbol: "calendar",
            what: "Was du wann gesehen hast, der Reihe nach. "
                + "Eintragen geht schon — auf jeder Filmseite.",
            step: "M5 5.4"
        )
    }
}

/// Das eigene Profil (M5 5.6).
struct ProfileView: View {
    var body: some View {
        ComingSoon(
            title: "Profil",
            symbol: "person",
            what: "Dein Profil mit Zahlen, Favoriten und Binge-Listen — "
                + "so wie im Browser.",
            step: "M5 5.6"
        )
    }
}
