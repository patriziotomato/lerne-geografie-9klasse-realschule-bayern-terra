# 🌍 Geo-Quest — Geografie 9. Klasse (Realschule Bayern, Terra)

Gamifizierte Lern-App als mobile-first PWA: Multiple-Choice-Training für Geografie,
9. Jahrgangsstufe Realschule Bayern, thematisch orientiert am LehrplanPLUS und an der
Kapitelstruktur des Terra-Buchs (Klett). Pures TypeScript — kein Framework.

## Features

- **Lernkonzepte statt Auswendiglernen**: Jeder Inhalt hat 2–3 unterschiedlich
  formulierte Frage-Varianten. Gemeistert wird das *Konzept* (Leitner-System, 5 Boxen) —
  gezählt wird gelernter Inhalt, nicht beantwortete Fragen.
- **Auf Tempo getrimmt**: kurze Antwortoptionen und knappe Erklärungen (~290 statt
  ~470 Zeichen Lesestoff pro Frage), und bei einer richtigen Antwort blättert die App
  nach 1,2 s von selbst weiter.
- **Faire Fragen**: Die vier Optionen sind ungefähr gleich lang, damit man die richtige
  nicht an ihrer Länge erkennt; die Lösungsposition wird über jede Runde gleichmäßig
  auf A–D verteilt.
- **Deadline & Tagespensum**: Beim Start Lernziel-Datum festlegen; die App rechnet
  aus, wie viel pro Tag nötig ist, und zeigt, ob man auf Kurs ist.
- **Gamification**: XP, Level, Tages-Streaks, Combos, ~16 Abzeichen, Konfetti —
  und pro komplett gelerntem Kapitel eine Schatzkiste mit Sammel-Badge.
- **Lernzeiten & Erinnerungen**: Feste Lernzeiten (z. B. 14:30 & 20:30),
  Benachrichtigungen bei geöffneter App, Motivations-Nudges und Kalender-Export
  (.ics) für zuverlässige System-Erinnerungen. Handynummer wird fürs spätere
  SMS-Feature bereits erfasst (bleibt lokal).
- **Eltern-Bereich** (optional PIN-geschützt): Lernhistorie (wann, wie lange,
  wie viele Fragen, Quote), Fortschritt pro Kapitel, teilbarer Bericht.
- **PWA**: Installierbar auf dem Homescreen, funktioniert offline.

## Entwicklung

```bash
npm install
npm run dev        # Dev-Server
npm run build      # Typecheck + Produktions-Build nach dist/
npm run preview    # Build lokal testen
```

## Design

Das komplette Styling liegt in `src/styles.css` und hängt an einem Token-Block
am Dateianfang — Flächen, Schrift, Akzent, Radien, Abstände, Elevation. Ein
Theme ist damit ein reiner Wertetausch, keine zweite Regelmenge:

- **Dark** (Default): neutrales Schiefergrau.
- **Light**: neutrales Off-White, gleiche Struktur, eigene Werte im
  `prefers-color-scheme: light`-Block.

Beide Themes setzen `color-scheme`, damit native Bedienelemente (Datums- und
Zeit-Picker, Checkboxen, Scrollbars) mitziehen.

Drei Regeln halten die Oberfläche ruhig:

1. **Ein Akzent.** `--accent` trägt jede Aktion und jeden Fortschritt —
   Primärbutton, Level-Ring, XP- und Wochenbalken, aktiver Tab, Zielnote. Es
   gibt keine Verläufe.
2. **Farbe bedeutet etwas.** Außer dem Akzent erscheinen nur `--ok`,
   `--danger` und `--warn`, und nur dort, wo sie eine Aussage tragen
   (richtig, falsch, hinter dem Plan). Alles andere ist Graustufe.
3. **Kanten statt Schatten.** Flächen werden über `--line` und kleine Radien
   (3–10 px) getrennt; Schatten bleiben echten Overlays vorbehalten.

Alle Farbpaare, die Text tragen, sind auf ≥ 4,5:1 ausgelegt — in beiden
Themes. Deshalb ist `--accent` im Light-Theme deutlich dunkler als im
Dark-Theme, und `--on-accent` wechselt entsprechend.

Kapitelfarben stehen als `color` in `src/data/chapters.ts` und landen per
Inline-`--ch-color` auf Kapitelkarte, Fortschrittsring und Themen-Kachel. Es
sind bewusst entsättigte Mitteltöne, damit sie auf beiden Untergründen tragen.

App-Icons werden aus `public/icons/icon.svg` gerendert; die PNG-Größen
(180/192/512 plus maskable) sind Rasterisate derselben Datei.

## Inhalte bearbeiten

Die Fragen liegen als editierbare JSON-Dateien in `src/data/questions/*.json`:

```jsonc
{
  "chapterId": "landschaften",
  "concepts": [
    {
      "id": "landschaften-c01",
      "topic": "Großlandschaften Deutschlands",
      "variants": [
        {
          "text": "Fragetext …?",
          "options": ["RICHTIG", "falsch", "falsch", "falsch"],  // richtige Antwort IMMER an Position 0
          "explanation": "Kurze Begründung.",
          "difficulty": 1
        }
      ]
    }
  ]
}
```

Die App mischt die Antwortreihenfolge beim Anzeigen. Kapitel-Metadaten (Titel,
Emoji, Farben, Kisten-Badges) stehen in `src/data/chapters.ts`.

### Regeln für neue Fragen

`npm run check:questions` prüft die JSON-Dateien (und läuft auch im `build`, ein
Verstoß blockt also den Deploy):

| Regel | |
|---|---|
| Antwortoption | max. 60 Zeichen |
| **Längen-Spreizung** | längste minus kürzeste Option max. **15 Zeichen** |
| Erklärung | max. 110 Zeichen |
| längste = richtig | über den Gesamtbestand max. 30 % |
| Konzept-IDs & Fragetexte | müssen zu `scripts/questions-baseline.json` passen |

Die Spreizungsregel ist die wichtigste: Waren die vier Optionen unterschiedlich
lang, war die richtige Antwort in 74 % der Fälle einfach die längste — man kam
ohne jedes Wissen auf ~74 % richtig. **Distraktoren also genauso konkret und
genauso lang formulieren wie die richtige Antwort**, nicht die richtige Antwort
verwässern.

Konzept-IDs sind der Schlüssel des Leitner-Fortschritts im localStorage: Ändert
sich eine ID, verliert die Nutzerin ihren Lernstand. Werden bewusst Konzepte
ergänzt oder Fragetexte geändert, die Baseline neu erzeugen mit
`node scripts/check-questions.mjs --update-baseline`.

## Deployment (GitHub Pages)

Bei jedem Push auf `main` baut GitHub Actions die App und deployt sie auf GitHub
Pages (`.github/workflows/deploy.yml`). Falls das erste Deployment fehlschlägt:
in den Repo-Einstellungen unter **Settings → Pages** als Source „GitHub Actions"
wählen.

## Roadmap

- SMS-Erinnerungen über kleinen Server (z. B. Cloudflare Workers + Twilio)
- Eltern-Fernzugriff (Konto/Sync statt nur lokalem Gerät)
- Native App-Wrapper (Capacitor)
- Weitere Fächer/Klassenstufen als App-Serie
