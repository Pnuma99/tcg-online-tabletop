# TCG Online Tabletop – iPhone Sandbox v0.4

Ein einfacher gemeinsamer Spieltisch für zwei Personen, mit iPhone-Querformat-Unterstützung.

## Funktionen
- Raumcode für zwei Spieler (WebSocket)
- Pro Spieler drei Positionen in der Frontlinie und drei in der Rücklinie
- Kartenbilder von iPhone importieren (PNG/JPEG/WebP, max. 450 KB je Bild)
- Deck mischen, ziehen, Karten ausspielen, verdeckte eigene Hand
- W20 und frei wählbarer Würfel
- Frei setzbare HP, Angriff, Rüstung, Energie und benannte Counter
- Additiv stapelbare Buffs/Debuffs (zweimal +3 = +6)
- Optionaler automatischer Angriff; manuelle Änderungen jederzeit möglich

## Auf GitHub hochladen (iPhone)
1. ZIP in der Dateien-App antippen und entpacken.
2. In Safari dein Repository öffnen.
3. **Add file → Upload files** wählen (ggf. Desktop-Website anfordern).
4. Die Dateien `package.json`, `server.js`, `render.yaml`, `.gitignore` und `README.md` in die Repository-Wurzel laden.
5. Über **Add file → Create new file** die Pfade `public/index.html`, `public/app.js` und `public/style.css` anlegen und den Inhalt der entsprechenden entpackten Dateien einfügen. Alternativ einen Git-Client für iOS verwenden, der Ordner hochladen kann.
6. Committen. **Wichtig:** GitHub entpackt eine hochgeladene ZIP-Datei nicht automatisch.

## Render bereitstellen
Render Dashboard → New → Web Service → GitHub-Repository auswählen.
Die `render.yaml` kann alternativ für ein Blueprint verwendet werden.
Build: `npm install`; Start: `npm start`; Runtime: Node.
Nach dem Deploy die HTTPS-Adresse in Safari öffnen und Raumcode teilen.

## Lokal starten (optional)
Node.js >= 20: `npm install && npm start` → http://localhost:3000

## Grenzen der Testversion
- Server hält den Spielzustand nur im RAM; nach Neustart sind laufende Spiele weg.
- Render Free kann bei Inaktivität einschlafen.
- Kartenbilder werden im Raumzustand übertragen und sind nicht dauerhaft gespeichert.
- Die Web-App kann iOS nicht zuverlässig in Querformat zwingen: iPhone drehen und Ausrichtungssperre deaktivieren.
- Kein produktionsreifes Login/Anti-Cheat-System. Nur für private Tests.
- Es wurde keine vollständige Ende-zu-Ende-Mehrspielerprüfung durchgeführt.


## Karteneditor (neu)
Im Hauptmenü „Karteneditor“ wählen. Die Karte wird im Format 67 × 92 mm gerendert. Eigene Artworks und Rollen-Icons hochladen, Effekttexte und Schriftparameter ändern, Rahmenfarbe wählen und PNG mit optionalem Beschnitt exportieren. „In Deckbuilder speichern“ übernimmt das gerenderte Kartenbild samt Name, Angriff und Leben in die lokale Kartenbibliothek. Projekte können als JSON einschließlich eingebetteter Bilder gesichert und geladen werden.

Hinweis: Das Kartenlayout ist eine editierbare Annäherung an die Beispielkarte, keine pixelgenaue Rekonstruktion. Große Bilder können das Browser-Speicherlimit überschreiten; im Zweifel das PNG exportieren.
