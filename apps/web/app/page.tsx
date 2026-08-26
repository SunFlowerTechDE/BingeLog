export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-semibold tracking-tight">BingeLog</h1>
      <p className="text-muted-foreground text-balance">
        Trag ein, was du gesehen hast. Bewerte es. Red darüber mit Leuten, die den Film
        auch gesehen haben.
      </p>
      <p className="text-muted-foreground text-sm">
        Das Fundament steht. Suche, Filmdetail und Bewertung kommen mit M3.
      </p>
    </main>
  );
}
