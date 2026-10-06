# Pizzahaus – Raumplan & Reservierungen

Internes Werkzeug zur Selbstplanung: Räume mit Tischen, Stühlen, Pflanzen, Theke usw. maßstabsgetreu einrichten und Reservierungen auf Tische legen.

- **`/raumplan`**: Räume anlegen (Breite × Länge in Metern), Objekte einfügen, verschieben, drehen, Größe ändern, Rückgängig/Wiederholen, Export/Import als JSON
- **`/`**: Datum + Uhrzeit wählen, Tische grün (frei) / rot (belegt), Tisch anklicken → Reservierung anlegen; Warnung bei zu wenig Stühlen oder Doppelbelegung

Daten liegen aktuell **nur im Browser** (localStorage). Zum Sichern oder Übertragen auf einen anderen Rechner: *Exportieren* / *Importieren*. Die Speicherschicht ist austauschbar (`src/storage/index.ts`), später kommt eine PHP/MySQL-Anbindung auf dem Hetzner-Webhosting dazu.

## Entwicklung

```sh
npm install
npm run dev      # Dev-Server
npm test         # Logik-Tests (vitest)
npm run build    # Typprüfung + Build nach dist/
```

## Aufbau

- `src/types.ts` – Datenmodell (alle Maße in cm)
- `src/catalog.ts` – Objektvorlagen (hier neue Objekte/Standardgrößen ergänzen)
- `src/stores/` – Pinia-Stores (Plan inkl. Undo, Reservierungen, automatisches Speichern)
- `src/components/plan/` – SVG-Zeichenfläche und Objektdarstellung
- `src/views/` – Reservierungs- und Editor-Ansicht
