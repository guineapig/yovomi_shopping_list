# Einkaufsliste für Yuvomi

Eigenständige, installierbare PWA für die Einkaufslisten deiner selbst gehosteten [Yuvomi](https://yuvomi.cloud/)-Instanz. Kein eigenes Backend mit eigenen Daten — die App verbindet sich direkt mit der API deines Servers.

## Wie es funktioniert

- **Anmeldung**: Server-URL, Benutzername, Passwort (inkl. 2FA) → die App tauscht das gegen ein langlebiges *Device Credential* (Bearer-Token), genau wie es native Yuvomi-Clients tun (`POST /api/v1/auth/devices`). Das Credential bleibt ausschließlich im Browser (`localStorage`), es wird nirgends sonst gespeichert.
- **CORS-Proxy**: Der Yuvomi-Server sendet selbst keine CORS-Header. Da diese PWA auf einer anderen Origin läuft, übernimmt ein zustandsloser Nitro-Server-Route (`server/api/y/[...path].ts`) die Weiterleitung – reiner Server-zu-Server-Durchreich ohne eigene Session.
- **Offline**: Listen werden in IndexedDB zwischengespeichert; Änderungen (Hinzufügen, Abhaken, Löschen) landen bei fehlender Verbindung in einer Outbox und werden automatisch synchronisiert, sobald die Verbindung wieder da ist.

## Entwicklung

```bash
npm install
npm run dev
```

## Produktion

```bash
npm run build
node .output/server/index.mjs
```

Für Installierbarkeit (Service Worker, "Zum Homescreen hinzufügen") muss die App über **HTTPS** ausgeliefert werden.

## Hinweise

- Die App-Icons (`public/icon-*.png`) sind Platzhalter – vor echtem Einsatz durch eigenes Branding ersetzen.
- Umfang bewusst fokussiert: Listen, Artikel, Gang-Gruppierung nach Kategorie, Offline-Anzeige mit Sync-Status. Zusatzfunktionen der Yuvomi-API (Preis-Historie, Shops, Meal-Plan-Import, Pantry-Import, Listen-Versand per Mail, CalDAV) sind nicht angebunden, lassen sich aber über `app/composables/useYuvomiApi.ts` leicht ergänzen.
