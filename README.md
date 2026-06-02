# 🛒 Warenkorb-Helfer für Playmobil Ersatzteile - Chrome Extension

Eine Chrome-Extension zum automatisierten Befüllen, Exportieren und Leeren des Playmobil-Warenkorbs.

---

## Lizenz

Diese Extension steht unter der MIT-Lizenz. Siehe die [LICENSE](LICENSE)-Datei für weitere Informationen.

## Installation

### Schritt 1: Extension herunterladen

1. Lade die neueste Version herunter: **[Download ZIP](https://github.com/ArcadeTV/playmobil-cart-helper-chrome-extension/archive/refs/heads/main.zip)**
2. Entpacke die ZIP-Datei in einen Ordner deiner Wahl

### Schritt 2: Extension in Chrome laden

1. Öffne Chrome und gehe zu `chrome://extensions/`
2. Aktiviere oben rechts den **Entwicklermodus**
3. Klicke auf **"Entpackte Erweiterung laden"**
4. Wähle den entpackten Ordner

### Schritt 3: Extension anpinnen (empfohlen)

1. Klicke auf das Puzzle-Symbol (🧩) rechts neben der Adressleiste
2. Finde "Warenkorb-Helfer für playmobil.com" in der Liste
3. Klicke auf das Pin-Symbol (📌), um die Extension anzupinnen

So ist das Icon immer sichtbar und schnell erreichbar.

### Schritt 4: Extension nutzen

1. Öffne [playmobil.com](https://www.playmobil.com)
2. Klicke auf das Extension-Icon in der Browser-Leiste
3. Nutze Import oder Export

> **Hinweis:** Die Extension funktioniert nur auf playmobil.com. Auf anderen Seiten wird eine entsprechende Meldung angezeigt.

## Features

### 📥 Import

- Artikelliste eingeben (Format: `Artikelnummer;Menge`)
- Automatische Verfügbarkeitsprüfung vor dem Import
- Ein-Klick-Import in den Warenkorb
- **Live-Fortschrittsanzeige** während des Imports
- Kein manuelles Kopieren in die Konsole nötig!
- **Detaillierte Ergebnisanzeige** nach dem Import:
  - Liste der erfolgreich importierten Artikel
  - Liste der nicht verfügbaren Artikel mit Links zu [playmodb.org](https://playmodb.org) und [playmobil.com](https://www.playmobil.com)
  - Buttons zum Öffnen aller nicht verfügbaren Artikel in playmodb.org oder playmobil.com
  - Button zum Speichern der nicht verfügbaren Artikel als Textdatei
  - **"Zum Warenkorb"**-Button nach erfolgreichem Import

### 📤 Export

- Warenkorb mit einem Klick exportieren
- Artikelliste wird automatisch in die Zwischenablage kopiert
- Listen können lokal gespeichert werden

### 🗑️ Warenkorb leeren

- Entfernt alle Artikel aus dem Warenkorb
- **Live-Fortschrittsanzeige** während des Löschens
- Automatische Wiederholung bei Rate-Limit
- Funktioniert auch bei eingeloggten Accounts

## Hinweis

Diese Extension ist ein unabhängiges Open-Source-Projekt und steht in keiner Verbindung zur Playmobil® / geobra Brandstätter Gruppe.

## Verwandtes Projekt

Siehe auch das [Web-Tool](https://arcadetv.github.io/playmobil-cart-helper/) für eine browserbasierte Alternative ohne Extension-Installation.

## Changelog

### v1.2.0

- **Neu:** 🗑️ Warenkorb leeren - Entfernt alle Artikel mit einem Klick
- **Neu:** Live-Fortschrittsanzeige beim Import und Leeren
- **Neu:** "Zum Warenkorb"-Button nach erfolgreichem Import
- **Neu:** Links zu playmobil.com für nicht verfügbare Artikel
- **Neu:** Tab-Zustand wird beim Schließen gespeichert
- **Neu:** Automatische Wiederholung bei Rate-Limit
- Verbesserte UI mit besserer Übersichtlichkeit

### v1.1.0

- **Neu:** Detaillierte Ergebnisanzeige nach dem Import
- **Neu:** Nicht verfügbare Artikel werden mit Links zu playmodb.org angezeigt
- **Neu:** Button zum Öffnen aller nicht verfügbaren Artikel in playmodb.org (neue Tabs)
- **Neu:** Button zum Speichern der nicht verfügbaren Artikel als Textdatei
- Verbesserte Fehlerbehandlung

### v1.0.0

- Initiale Version
- Import: Artikelliste in Warenkorb importieren
- Export: Warenkorb als Artikelliste exportieren
- Automatische Verfügbarkeitsprüfung
- Warnung wenn nicht auf playmobil.com
