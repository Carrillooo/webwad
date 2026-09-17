# Sapphire Personal — aviso de origen y licencia

Este directorio es una obra derivada de **Sapphire**, de Shariq Charolia:
<https://github.com/cshariq/Sapphire>

- **Licencia:** GNU AGPL v3.0. El texto original se conserva en `LICENSE`.
- **Commit de partida:** `798d117` (2026-09-16).
- **Atribuciones:** `CREDITS.md` y las cabeceras de autoría de cada fichero se
  mantienen intactas.

Al ser AGPL, cualquier redistribución o uso en red de esta versión modificada
obliga a publicar su código fuente bajo la misma licencia.

## Qué se ha modificado respecto a upstream

Ver `DOCS-ES/AUDITORIA.md` para el detalle con líneas exactas. En resumen:

- `Sapphire/Services/FaceID/FaceIDEngine.swift` — la comprobación de liveness
  deja de fallar «hacia abierto»; se elimina un `if false` que desactivaba la
  comprobación durante el registro.
- `Sapphire/Services/Auth/AuthenticationManager.swift` — nuevo evento de
  seguridad y estado publicado para el notch.
- `Sapphire/Services/Music/Spotify/SpotifyAppleScript.swift` — validación de URI
  antes de interpolarla en AppleScript, volumen acotado, `seek` robusto.
- `Sapphire/Services/Music/Spotify/SpotifyOfficialAPI.swift` — `resume()` real.
- `Sapphire/Services/Music/MusicManager.swift` — reanudar deja de enviar una URI
  vacía; el estado de reproducción no se muestra como confirmado si falla.
- `Sapphire/Services/FaceID/FaceIDAppleStyleViews.swift` — **nuevo**: anillo de
  poses y tarjeta de autenticación.

## Qué NO se ha hecho

- No se han falsificado licencias, suscripciones ni acceso a los servidores de
  Sapphire. Los stubs de `Sapphire/Stubs/` siguen devolviendo «sin acceso».
- No se ha intentado recuperar la clave privada del autor para descifrar el
  modelo de liveness.
- No se ha enviado nada al repositorio original.
