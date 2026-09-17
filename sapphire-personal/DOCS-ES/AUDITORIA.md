# Sapphire Personal — auditoría y plan por fases

Base: `cshariq/Sapphire` @ `798d117` (2026-09-16). 482 ficheros Swift, ~171 000
líneas, AGPL-3.0. Objetivo de despliegue fijado en **macOS 26.0** (Apple Silicon).

---

## 1. Hallazgos verificados

Los cuatro defectos que señalabas existen. Todos verificados leyendo el código,
con la línea original de upstream.

### 1.1 CRÍTICO — Face ID autenticaba sin comprobar suplantación

`Sapphire/Services/FaceID/FaceIDEngine.swift:774` y `:779` (upstream)

```swift
var frameIsReal = true                                   // ← valor por defecto
if SettingsModel.shared.settings.faceIDAntiSpoofEnabled,
   let liveness = FaceIDModelManager.shared.evaluateAntiSpoof(...) {
    frameIsReal = (smoothLiveness >= activeThreshold)
}
```

`evaluateAntiSpoof` devuelve `nil` en **cuatro** caminos distintos (modelo no
cargado, recorte menor de 30 px, buffer no disponible, salida inesperada del
modelo). En todos ellos el `if let` no entra, `frameIsReal` se queda en `true` y
se autentica **sin ninguna comprobación de liveness**.

Y no es un caso teórico: **el modelo de liveness no se distribuye con el
repositorio.** En `Sapphire/Services/FaceID/Models/` sólo está `ArcFace`
(reconocimiento). El de liveness se busca en
`~/Library/Caches/com.sapphire.faceid/PassiveLiveness.mlmodelc` o se descifra
desde un `.enc` con la clave del autor. Para quien compile desde este
repositorio, el resultado por defecto es que **una foto en un móvil desbloquea**.

**Corregido:** `frameIsReal` arranca en `false`. Se añade un estado tri-valor
(`LivenessModelAvailability`: `unknown` / `loading` / `ready` / `unavailable`)
para distinguir «aún cargando» de «no está»:

- `ready` → se evalúa normalmente.
- `unknown` / `loading` → el fotograma se descarta sin puntuar, sin cortar la
  sesión (evita un falso fallo durante el warm-up del modelo).
- `unavailable` → no se autentica nunca; se emite `.livenessUnavailable` y se
  cae a contraseña.
- Fotograma no evaluable → se descarta, no cuenta.

El usuario puede seguir desactivando el anti-spoofing a propósito
(`faceIDAntiSpoofEnabled = false`); esa rama es ahora explícita y está comentada.

### 1.2 CRÍTICO — El registro facial no comprobaba liveness

`FaceIDEngine.swift:686` (upstream)

```swift
if false && SettingsModel.shared.settings.faceIDAntiSpoofEnabled, ...
```

El `if false &&` dejaba la comprobación en código muerto. Se podía **registrar
una fotografía** como plantilla facial, que quedaba válida para siempre.

**Corregido:** la comprobación se ejecuta de verdad y exige el modelo cargado
antes de aceptar una muestra.

### 1.3 Spotify — reanudar enviaba una URI vacía

`Sapphire/Services/Music/MusicManager.swift:719` y `:729` (upstream)

```swift
_ = await spotifyAppleScript.play(uri: "")     // → play track ""
_ = await spotifyOfficialAPI.playTrack(uri: "") // → {"uris":[""]} → HTTP 400
```

Ninguna de las dos reanuda. AppleScript recibe un comando inválido y la API
oficial responde 400. Además el fallo se descartaba con `_ =` mientras la UI ya
había aplicado `applyPlayingState(true)`, fijado 3 s por
`beginSpotifyPlayStateReconcile`: **la interfaz mostraba «reproduciendo» con la
música parada.**

**Corregido:** se usa `spotifyAppleScript.play()` (que sí es `play`) y un
`SpotifyOfficialAPI.resume()` nuevo (`PUT /me/player/play` sin cuerpo). Si el
comando falla, `revertOptimisticPlayState()` deshace el estado optimista y
limpia la ventana de reconciliación para que el sondeo real mande de inmediato.

### 1.4 Spotify — inyección de AppleScript por URI sin validar

`Sapphire/Services/Music/Spotify/SpotifyAppleScript.swift:58` (upstream)

```swift
let script = "tell application \"Spotify\" to play track \"\(uri)\""
```

`uri` se interpolaba sin validar. Una URI con comillas cierra el literal e
inyecta AppleScript arbitrario.

**Corregido:** `isValidSpotifyURI(_:)` exige la forma
`spotify:<tipo>:<22 caracteres base62>`, con el tipo en una lista cerrada. Al
admitir sólo base62 y `:`, es imposible que la cadena contenga comillas, barras
invertidas o saltos de línea.

También: volumen acotado a 0–100 (antes se interpolaba sin límite) y `seek`
rechaza valores no finitos (un `NaN` se interpolaba como `"nan"`).

### 1.5 Stubs — estado real

`Sapphire/Stubs/` contiene 35 ficheros bajo `#if !SAPPHIRE_FULL_BUILD`. No son
un candado: **es código ausente**. `SubscriptionCore.swift` declara 50+
`AppFeature` y `hasAccess(to:)` devuelve `false` siempre; `AppLockManager` es una
cáscara (`authenticateAndUnlock()` → `false`). Quitar el candado no implementa lo
que falta. Confirmado tal cual lo describías.

Para tu edición personal, lo honesto es implementar equivalentes propios función
por función, no fingir entitlements. Ninguna de estas funciones está operativa
hoy y así consta en la tabla de abajo.

---

## 2. Estado de las funciones

| Función | Estado | Nota |
|---|---|---|
| Face ID — fail-closed sin modelo | ✅ Corregido | No autentica sin liveness |
| Face ID — liveness en el registro | ✅ Corregido | Eliminado el `if false` |
| Face ID — anillo de poses estilo Apple | ✅ Implementado | Sin compilar (ver §4) |
| Face ID — tarjeta de autenticación | ⚠️ Vista lista, sin enganchar al notch | Ver §3 |
| Face ID — liveness funcionando | ❌ Bloqueado | Falta el modelo, cifrado con clave ajena |
| Spotify — reanudar | ✅ Corregido | |
| Spotify — validación de URI | ✅ Corregido | |
| Spotify — volumen / seek | ✅ Corregido | |
| Spotify — estado honesto al fallar | ✅ Corregido | |
| Spotify — control local (play/pausa/saltar) | 🟡 Upstream, sin verificar | Requiere Mac |
| Spotify — OAuth PKCE, cola, Connect | 🟡 Upstream, sin auditar | Fase 3 |
| Llamadas (WhatsApp / FaceTime / iPhone) | ❌ Sin empezar | Fase 4 |
| Panel de apariencia y transparencia | ❌ Sin empezar | Fase 2 |
| Suscripción / App Lock / premium | ❌ Ausente en upstream | Stubs vacíos |

✅ hecho · 🟡 heredado sin verificar · ⚠️ parcial · ❌ pendiente o bloqueado

---

## 3. Por qué la tarjeta del notch no está enganchada

La vista `FaceIDNotchAuthView` está escrita y el estado ya se publica
(`AuthenticationManager.faceIDNotchPhase` y `.activeAuthController`). Falta que
el notch **se expanda** para mostrarla.

El notch dimensiona su contenido a partir de `LiveActivityType`, y ese enum se
consume en **13 `switch` repartidos por 10 ficheros** (`NotchController`,
`NotchActivityContentView`, `NotchExpandedChrome`, `SettingsPanes`,
`LiveActivityManager`, `AppModels`, `ActivityType`…). Añadir `case faceID` a
ciegas, sin compilador, dejaría el proyecto sin compilar en varios sitios a la
vez — justo lo que este proyecto prohíbe.

Es el primer paso a hacer en tu Mac, con Xcode abierto: añadir el caso, dejar
que el compilador liste los `switch` que faltan, y renderizar
`FaceIDNotchAuthView` en `NotchController.notchContent(config:)`.

---

## 4. Lo que no he podido probar

Esta sesión corre en un contenedor **Linux x86_64**: no hay macOS, ni Xcode, ni
toolchain de Swift. **Nada de esto se ha compilado ni ejecutado.**

Verificado por lectura: balance de llaves y paréntesis, coincidencia exacta de
cada sustitución, `switch` exhaustivos sobre `FaceIDSecurityEvent` actualizados
(sólo hay uno), `@ViewBuilder` en `ViewModifier.body`, y que el fichero nuevo
entra en el target (el proyecto usa `PBXFileSystemSynchronizedRootGroup`, así que
los ficheros se recogen del sistema de archivos).

Sin probar: que compile, el aspecto real del anillo, el rendimiento de la cámara,
y cualquier cosa que dependa de permisos de macOS.

---

## 5. Plan por fases

1. **Compilar** (tu Mac). Resolver lo que salga, enganchar la tarjeta al notch.
2. **Apariencia y transparencia.** Panel con vista previa, opacidad separada de
   la legibilidad, presets, persistencia.
3. **Spotify a fondo.** Auditar `SpotifyLogin`/`SpotifyPrivateAPI`, PKCE con
   `state` validado, tokens en Keychain, cola y Connect.
4. **Llamadas.** Investigar primero qué expone cada app; sin integración
   comprobable, sólo abrir la ventana de llamada y decirlo en los ajustes.
5. **Autenticación.** `LocalAuthentication` (Touch ID / contraseña) como vía
   soportada; el reconocimiento por webcam queda marcado como experimental.
6. **Resto de módulos** y limpieza de interruptores sin efecto.
