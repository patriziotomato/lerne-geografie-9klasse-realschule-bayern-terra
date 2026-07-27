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
- **Zielnote & Meilensteine**: Zielnote wählen, dann zeigt die App, wie viele
  Fragerunden noch bis zur nächstbesseren Note fehlen — die Zahl sinkt mit jeder
  Runde. Solange der Lernstand rechnerisch erst bei einer 6 liegt (am Anfang zählt
  jeder ungelernte Inhalt mit 0), wird bewusst keine Note genannt, sondern nur der
  Weg dorthin. Eine erstmals erreichte Note gibt Konfetti und eine
  Benachrichtigung. Der Eltern-Bereich zeigt weiterhin den ungeschönten Stand.
- **Breite zählt mit**: In die Notenschätzung geht zu vier Fünfteln der Lernstand
  ein und zu einem Fünftel die Themenabdeckung — wie viel vom Lernplan überhaupt
  schon einmal dran war. Jedes Thema einmal angeschaut zählt damit besser als
  wenige Themen immer wieder, und die Karte sagt auch, wie viele Themen noch
  offen sind. Details und Herleitung stehen in `src/logic/grade.ts`.
- **Lernzeiten & Erinnerungen**: Feste Lernzeiten (z. B. 14:30 & 20:30),
  Benachrichtigungen bei geöffneter App, Motivations-Nudges und Kalender-Export
  (.ics) für zuverlässige System-Erinnerungen. Handynummer wird fürs spätere
  SMS-Feature bereits erfasst (bleibt lokal).
- **Eltern-Bereich** (optional PIN-geschützt): Lernhistorie (wann, wie lange,
  wie viele Fragen, Quote), Fortschritt pro Kapitel.
- **Lernbericht als PDF oder Eltern-Link**: Der Bericht geht als fertige Datei
  oder als Link raus, den Eltern selbst öffnen — nicht mehr als Fließtext, der
  sich im Messenger vor dem Absenden überschreiben ließ. Siehe
  [Der Lernbericht](#der-lernbericht).
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

## Der Lernbericht

Der Eltern-Bereich gibt den Lernstand auf zwei Wegen heraus — beide erzeugen
etwas Fertiges, keinen editierbaren Text:

| Weg | Was passiert |
|---|---|
| **📄 PDF** | Wird auf dem Gerät gerendert (`logic/pdf.ts` + `logic/reportPdf.ts`, ohne Bibliothek) und über den Teilen-Dialog bzw. als Download weitergegeben. |
| **🔗 Eltern-Link** | Der komplette Bericht steckt verschlüsselt im URL-Fragment. Eltern öffnen ihn und sehen dieselbe Ansicht wie die App — ohne App, ohne Konto, ohne abzutippen. |

Alles hängt an einem einzigen Datentyp: `ReportData` in `logic/report.ts`.
`buildReport()` zieht die Momentaufnahme aus dem Zustand, und **derselbe**
Renderer (`views/reportBody.ts`) bedient danach den Eltern-Bereich und die
Link-Ansicht. Zwei Renderer wären zwei Wahrheiten — und ausgerechnet der Link,
den niemand mehr gegenprüfen kann, würde still veralten.

Der Bericht rechnet bewusst **nichts nach**: „noch 62 Tage" gilt für den
Erstellungszeitpunkt. Würde das Elterngerät den Wert beim Öffnen neu berechnen,
stünden frische neben alten Zahlen im selben Dokument.

### Was der Link schützt — und was nicht

Die App liegt auf GitHub Pages und hat keinen Server. Der Bericht entsteht
deshalb immer auf dem Gerät, auf dem gelernt wird. Daraus folgt eine Grenze, die
keine clientseitige Lösung verschieben kann: **Absolute Echtheit ist nicht
beweisbar.** Was der Link (`logic/parentLink.ts`) leistet:

- ✅ **Manipulationen fallen auf.** Der Bericht liegt AES-GCM-verschlüsselt im
  Fragment, der Schlüssel kommt per PBKDF2 aus einem 8-stelligen Zufallscode am
  Tokenanfang. Ein verändertes Token *scheitert* am GCM-Tag, statt still andere
  Zahlen zu zeigen.
- ✅ **Nichts wird hochgeladen.** URL-Fragmente gehen nie an einen Server — kein
  Log, kein Referer. Die Lerndaten erreichen nur, wer den Link bekommt.
- ✅ **Die Hürde steigt.** Wer schönen will, muss PBKDF2 + AES-GCM nachbauen
  statt JSON in der Adresszeile zu ändern.
- ❌ **Vertraulich ist der Link nicht.** Der Code reist mit; wer ihn hat, sieht
  den Bericht. Er schützt gegen zufälliges Finden, nicht gegen Weiterleiten.
- ❌ **Live ist er nicht.** Er ist eine Momentaufnahme und altert.

Prüfbar bleibt vor allem der **Stichtag**. Deshalb steht er in PDF und
Link-Ansicht ganz oben, die Ansicht warnt ab zwei Tagen Alter, und ein
Erstellungsdatum in der Zukunft wird ausdrücklich angesprochen. Der Weg mit der
größten Sicherheit steht in beiden Ansichten dabei: den Eltern-Bereich direkt
auf dem Lerngerät öffnen.

### Technische Eckdaten

- **Route** `#/bericht/<token>` — steht in `router.ts` in `OPEN_ROUTES` und
  überspringt damit die Onboarding-Weiterleitung. Auf dem Elterngerät gibt es
  kein Profil; ohne diese Ausnahme landete der Link in der App-Einrichtung.
- **Token** = 8 Zeichen Code + base64url(`[version][salt 16][iv 12][ciphertext+tag]`).
  Die Version geht als AAD in die Verschlüsselung ein.
- **Kompression** ist nicht optional gedacht: 20 Lerneinheiten sind ~2,8 kB JSON.
  Mit `deflate-raw` wird der Link ~1270 statt ~3930 Zeichen lang. Fehlt
  `CompressionStream`, funktioniert er ungepackt weiter; kann umgekehrt ein altes
  Elterngerät nicht entpacken, sagt die Ansicht genau das — und nicht
  „beschädigt".
- **PDF**: A4, Graustufen, Helvetica in WinAnsi. Die PDF-Standardschriften können
  keine Emojis, Kapitel kommen deshalb aus `Chapter.short` statt `emoji + short`.
  Dateinamen werden nach ASCII transliteriert (Groß → Gross): Chrome verwirft ein
  `download`-Attribut mit Nicht-ASCII **komplett** und legt die Datei als
  „download" ab — bei deutschen Vornamen also fast immer.

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

Derselbe Build läuft schon am Pull Request — mit derselben Umgebung
(`GITHUB_PAGES=true`), aber ohne die Deployment-Schritte: `configure-pages`,
der Artefakt-Upload und der `deploy`-Job sind an `github.event_name !=
'pull_request'` gehängt. Ein Fehler fällt damit als roter Check am PR auf und
nicht erst als fehlgeschlagenes Live-Deployment. Die Concurrency-Gruppe hängt
deshalb am Ref (`pages-${{ github.ref }}`) statt global an `pages`: Sonst
könnte ein PR-Build ein laufendes Deployment von `main` abbrechen.

### Welcher Stand ist live?

Jeder Build bekommt einen Stempel aus Commit und Build-Zeit. `vite.config.ts`
nimmt den Hash aus `GITHUB_SHA` (in der Action gesetzt) oder lokal aus
`git rev-parse HEAD` und setzt ihn an zwei Stellen ein:

| Ort | Wofür |
|---|---|
| Fußzeile unter „Mehr" (Einstellungen) | für Menschen — antippen kopiert den Stempel für Fehlermeldungen |
| `<meta name="app-version\|app-commit\|app-build-time">` im `<head>` | maschinenlesbar, auch ohne Profil (ohne Profil zeigt der Router nur das Onboarding) |

Den ausgelieferten Stand prüfen, ohne die App zu öffnen:

```bash
curl -s https://patriziotomato.github.io/lerne-geografie-9klasse-realschule-bayern-terra/ \
  | grep app-commit
```

Zeigt das noch den vorherigen Commit, ist der Deploy nicht durch (oder das CDN
liefert noch die alte Antwort) — der Actions-Run allein sagt das nicht.

Die Werte stecken im gehashten JS-Bundle, nicht in einer eigenen Datei unter
`public/`: Alles Ungehashte liefert der Service Worker cache-first aus, die App
würde damit den vorigen Deploy als aktuell melden.

Aus demselben Grund hängt der Cache-Name des Service Workers am Commit. `main.ts`
registriert ihn als `sw.js?v=<hash>`, `public/sw.js` liest den Wert daraus.
Jeder Deploy räumt so den alten Cache weg — **die Version in `sw.js` muss nicht
mehr von Hand gebumpt werden.** Gelesen wird nur aus dem Cache des eigenen
Builds (nicht über das globale `caches.match()`), damit während des Wechsels
keine veraltete Datei aus dem Cache des Vorgängers zurückkommt.

## Roadmap

- SMS-Erinnerungen über kleinen Server (z. B. Cloudflare Workers + Twilio)
- **Eltern-Fernzugriff live** (Cloudflare Worker + KV): Der Eltern-Link ist heute
  eine Momentaufnahme, die das Kind verschicken muss. Mit einem kleinen Server
  bekämen Eltern *einen* dauerhaften Link, der immer den letzten Stand zeigt —
  samt „zuletzt synchronisiert vor X". Die Naht dafür liegt schon: Transportiert
  wird genau das `ReportData` aus `logic/report.ts`, `views/reportBody.ts` und
  der PDF-Export bleiben unverändert. Zu klären wäre dann, dass der Lernstand
  den Gerätespeicher verlässt.
- Native App-Wrapper (Capacitor)
- Weitere Fächer/Klassenstufen als App-Serie
