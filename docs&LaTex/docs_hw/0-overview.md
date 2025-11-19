# GPS tracker — přehled a rychlý start

Tato kapitola shrnuje účel hardwarové dokumentace, hlavní funkce zařízení a postupy pro sestavení a první nasazení. Detailní technické schéma a sekvenční diagramy jsou uloženy v `docs_hw/schemas/`.

## Hlavní schopnosti

- Periodická akvizice polohy z externího GPS modulu (např. NEO‑6M).
- Přenos dat na server přes mobilní síť (LTE/GPRS) s použitím HTTPS.
- Lokální persistnce do `LittleFS` s možností dávkového odesílání pro snížení spotřeby a zvýšení spolehlivosti.
 - Lokální persistnce do `LittleFS` s možností dávkového odesílání pro snížení spotřeby a zvýšení spolehlivosti (efektivní velikost dávky ve firmware: 15 záznamů). Poznámka: backend je přizpůsoben pro bezpečné zpracování až 15 záznamů na upload — odesílání větších dávek může způsobit HTTP 500.
- Odolnost vůči krátkodobým výpadkům sítě (zachování a dozaslání dat po obnovení připojení).
- Dva provozní režimy: tracker (běžný provoz) a servisní/OTA režim pro konfiguraci a aktualizace.

## Obsah hardwarové dokumentace

- `1-hardware.md` — zapojení, mapování pinů, napájení.
- `2-firmware.md` — architektura firmware, režimy spánku, správa periferie.
- `3-configuration.md` — nastavení APN, serveru, parametrů OTA a chování řízeného serverem.
- `4-data-format.md` — formát odesílaných dat a handshake protokoly.
- `5-ota.md` — servisní režim, OTA postupy a bezpečnostní aspekty.
- `reference/`, `schemas/` — schémata, obrázky a pomocné soubory.