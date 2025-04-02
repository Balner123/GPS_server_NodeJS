# GPS Tracking Server

Node.js server pro sledování GPS pozic zařízení.

## Funkce

- Ukládání GPS souřadnic pro více zařízení
- Real-time sledování aktuálních pozic
- REST API pro komunikaci s klienty
- SQLite databáze pro ukládání dat

## Instalace

1. Klonování repozitáře:
```bash
git clone [repository-url]
cd gps-server
```

2. Instalace závislostí:
```bash
npm install
```

3. Vytvoření souboru .env:
```bash
cp .env.example .env
```

4. Spuštění serveru:
```bash
npm start
```

## API Endpoints

### POST /device_input
Přijímá GPS data od zařízení.

Request body:
```json
{
  "device": "string",
  "longitude": number,
  "latitude": number
}
```

### GET /current_coordinates
Vrací aktuální pozice všech zařízení.

### GET /device_data
Vrací historická data pro konkrétní zařízení.

Query parameters:
- name: název zařízení

## Bezpečnost

- Rate limiting pro ochranu proti DDoS
- Validace vstupních dat
- CORS ochrana
- Sanitizace SQL dotazů

## Vývoj

Pro vývoj s automatickým restartem serveru:
```bash
npm run dev
```

## Docker-compose
  - docker-compose build
  - docker-compose up

## On Server
 https://github.com/Balner123/GPS_server_NodeJS

 http://129.151.193.104:5000/
