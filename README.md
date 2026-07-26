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
- **Zielnote & Meilensteine**: Zielnote wählen, dann zeigt die App, wie viele
  Fragerunden noch bis zur nächstbesseren Note fehlen — die Zahl sinkt mit jeder
  Runde. Solange der Lernstand rechnerisch erst bei einer 6 liegt (am Anfang zählt
  jeder ungelernte Inhalt mit 0), wird bewusst keine Note genannt, sondern nur der
  Weg dorthin. Eine erstmals erreichte Note gibt Konfetti und eine
  Benachrichtigung. Der Eltern-Bereich zeigt weiterhin den ungeschönten Stand.
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
