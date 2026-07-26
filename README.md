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
- **Themenkatalog**: Zwei Ebenen — Hauptthemen (Kapitel) lassen sich ganz abwählen,
  einzelne Unterthemen einzeln ausnehmen. Direkt an jeder Frage steht dafür
  „🙋 Thema noch nicht dran?" mit zwei Optionen:
  „🚫 hatten wir noch nicht" nimmt das Unterthema aus dem Lernplan (es zählt dann
  auch nicht mehr für Fortschritt, Schatzkiste und Tagespensum), und
  „📌 muss ich noch lernen" setzt es auf die **Merkliste**.
- **Merkliste**: Vorgemerkte Themen ruhen in normalen Runden, bleiben aber im
  Lernplan — sie müssen ja gelernt werden. Unter „📌 Merkliste" kann man sie gezielt
  üben und abhaken; bei Box 4 hakt sich ein Thema selbst ab.
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
- **Farbschema wählbar**: Automatisch (folgt dem Gerät), Hell oder Dunkel —
  einstellbar unter „Mehr → Darstellung".
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
- **Light**: neutrales Off-White, gleiche Struktur, eigene Werte.

Beide Themes setzen `color-scheme`, damit native Bedienelemente (Datums- und
Zeit-Picker, Checkboxen, Scrollbars) mitziehen.

### Farbschema umschalten

Das Schema hängt an `[data-theme]` auf `<html>`, **nicht** an
`prefers-color-scheme` — sonst ließe es sich in den Einstellungen nicht gegen
die Geräteeinstellung setzen. Beteiligt sind drei Stellen:

| Stelle | Aufgabe |
|---|---|
| `src/logic/theme.ts` | löst `'system'` gegen `matchMedia` auf, schreibt `data-theme` und die `theme-color`-Meta, reagiert auf Wechsel der Geräteeinstellung |
| `index.html` | Bootstrap-Skript, das `data-theme` **vor dem ersten Paint** setzt — sonst blitzt beim Start das falsche Schema auf |
| `src/styles.css` | `:root, :root[data-theme='dark']` bzw. `:root[data-theme='light']` |

Die Wahl (`settings.theme`: `'system' | 'light' | 'dark'`, Vorgabe `'system'`)
liegt im normalen `localStorage`-Zustand; Profile von vorher fallen über
`validTheme()` auf `'system'` zurück und verhalten sich damit wie bisher.

Weil das Bootstrap-Skript ohne Modul-Import auskommen muss, sind der
Storage-Schlüssel und die beiden `--bg`-Werte dort gespiegelt. Ändert sich
einer davon in `store.ts` oder `styles.css`, muss `index.html` mit.

Drei Regeln halten die Oberfläche ruhig:

1. **Eine Markenfarbe.** `--accent` (Pink) trägt Aktion, Fortschritt *und*
   „richtig": Primärbutton, Level-Ring, XP- und Wochenbalken, aktiver Tab,
   Zielnote, korrekte Antwort, Kapitelkante. Es gibt keine zweite
   Positivfarbe und keine Verläufe.
2. **Farbe bedeutet etwas.** Neben dem Akzent existieren nur `--danger`
   (falsch, zerstörende Aktion) und `--warn` (hinter dem Plan). Alles andere
   ist Graustufe — auch das Konfetti zieht seine Farben aus diesen Tokens.
3. **Kanten statt Schatten.** Flächen werden über `--line` und kleine Radien
   (3–10 px) getrennt; Schatten bleiben echten Overlays vorbehalten.

`--danger` liegt bewusst im warmen Rot statt im Rosé: neben dem pinken
„richtig" trennten die beiden sonst nur rund 25° Farbton, und im Quiz stehen
sie direkt untereinander.

Alle Farbpaare, die Text tragen, sind auf ≥ 4,5:1 ausgelegt — in beiden
Themes. Deshalb ist `--accent` im Light-Theme deutlich dunkler als im
Dark-Theme, und `--on-accent` wechselt entsprechend. Der Fokusring nutzt
`--ink`: auf einer Akzentfläche wäre ein Akzentring kaum zu sehen.

Kapitel haben **keine** eigenen Farben — sie unterscheiden sich über Emoji
und Titel. Sechs zusätzliche Farbtöne für Kapitelkarte, Ring und
Themen-Kachel waren der größte Posten im Farbhaushalt.

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
Emoji, Kisten-Badges) stehen in `src/data/chapters.ts`.

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
| `topic` | nicht leer und projektweit eindeutig |

Die Spreizungsregel ist die wichtigste: Waren die vier Optionen unterschiedlich
lang, war die richtige Antwort in 74 % der Fälle einfach die längste — man kam
ohne jedes Wissen auf ~74 % richtig. **Distraktoren also genauso konkret und
genauso lang formulieren wie die richtige Antwort**, nicht die richtige Antwort
verwässern.

Konzept-IDs sind der Schlüssel des Leitner-Fortschritts im localStorage: Ändert
sich eine ID, verliert die Nutzerin ihren Lernstand. Werden bewusst Konzepte
ergänzt oder Fragetexte geändert, die Baseline neu erzeugen mit
`node scripts/check-questions.mjs --update-baseline`.

`topic` ist das Unterthema im Themenkatalog und damit nutzersichtbar. Ein Konzept
ist genau ein Unterthema, deshalb muss `topic` eindeutig sein. Der gespeicherte
Schlüssel für Ausnahmen und Merkliste ist die Konzept-ID — der `topic`-Text lässt
sich also jederzeit umformulieren, ohne dass jemand seine Auswahl verliert.

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
