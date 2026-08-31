import SwiftUI

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
