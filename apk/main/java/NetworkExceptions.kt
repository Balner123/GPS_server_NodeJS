package com.example.gpsreporterapp

import java.io.IOException

/**
 * Obecná výjimka pro chyby při síťové komunikaci s API.
 */
open class ApiException(message: String, cause: Throwable? = null) : IOException(message, cause)

/**
 * Výjimka pro neautorizovaný přístup (HTTP 401, 403).
 * Signalizuje, že session je neplatná a je vyžadováno nové přihlášení.
 */
class UnauthorizedException(message: String) : ApiException(message)

/**
 * Výjimka pro chyby na straně serveru (HTTP 5xx).
 * Signalizuje dočasný problém, operaci je bezpečné zkusit později.
 */
class ServerException(message: String) : ApiException(message)

/**
 * Výjimka pro neočekávané nebo neobnovitelné chyby klienta (např. HTTP 400 Bad Request).
 */
class ClientException(message: String) : ApiException(message)
