/**
 * Die FSK-Kennzeichen.
 *
 * Die fuenf Stufen und ihre amtlichen Farben:
 *
 *   0   weiss    ohne Altersbeschraenkung
 *   6   gelb     ab 6 Jahren
 *   12  gruen    ab 12 Jahren
 *   16  blau     ab 16 Jahren
 *   18  rot      ab 18 Jahren
 *
 * Die Farben sind fest und nicht aus dem Farbschema der Seite: sie sind
 * das Erkennungszeichen. Ein blaues Kennzeichen, das im hellen Thema
 * gruen wuerde, waere kein Kennzeichen mehr.
 *
 * Deshalb steht die Zahl auch immer daneben oder darin — Farbe allein
 * traegt keine Information, wer sie nicht unterscheiden kann.
 */
export const FSK_STUFEN = [
  {
    wert: 0,
    label: 'FSK 0',
    text: 'ohne Altersbeschränkung',
    grund: '#ffffff',
    schrift: '#111111',
  },
  { wert: 6, label: 'FSK 6', text: 'ab 6 Jahren', grund: '#f2c200', schrift: '#111111' },
  { wert: 12, label: 'FSK 12', text: 'ab 12 Jahren', grund: '#009c49', schrift: '#ffffff' },
  { wert: 16, label: 'FSK 16', text: 'ab 16 Jahren', grund: '#0071b9', schrift: '#ffffff' },
  { wert: 18, label: 'FSK 18', text: 'ab 18 Jahren', grund: '#d4021d', schrift: '#ffffff' },
] as const;

export function fskStufe(wert: number | null) {
  return FSK_STUFEN.find((s) => s.wert === wert) ?? null;
}

export function FskLabel({ wert, size = 'md' }: { wert: number | null; size?: 'sm' | 'md' }) {
  const stufe = fskStufe(wert);

  // NULL heisst "wir wissen es nicht" und **nicht** "ohne
  // Beschraenkung". Der Unterschied ist bei einer Altersfreigabe kein
  // sprachlicher, deshalb steht hier ein eigenes, farbloses Zeichen.
  if (!stufe) {
    return (
      <span
        title="Altersfreigabe nicht bekannt"
        className={`border-border text-muted-foreground inline-flex items-center justify-center rounded border font-semibold ${
          size === 'sm' ? 'h-5 px-1.5 text-[10px]' : 'h-7 px-2 text-xs'
        }`}
      >
        FSK ?
      </span>
    );
  }

  return (
    <span
      title={`${stufe.label} — ${stufe.text}`}
      style={{ backgroundColor: stufe.grund, color: stufe.schrift }}
      className={`inline-flex items-center justify-center rounded font-bold ${
        // Ein Rand, damit das weisse Kennzeichen auf hellem Grund nicht
        // verschwindet.
        stufe.wert === 0 ? 'ring-1 ring-black/20' : ''
      } ${size === 'sm' ? 'h-5 px-1.5 text-[10px]' : 'h-7 px-2 text-xs'}`}
    >
      {stufe.label}
    </span>
  );
}
