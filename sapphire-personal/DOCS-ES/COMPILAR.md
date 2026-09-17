# Compilar Sapphire Personal en tu Mac

Objetivo de despliegue: **macOS 26.0**, Apple Silicon.

> Estos pasos no se han ejecutado: esta sesión corre en Linux, sin Xcode.
> Es el procedimiento a seguir, no una prueba superada.

## 1. Restaurar los binarios excluidos

Para no meter 158 MB de binarios en el repositorio, la vendorización dejó fuera
el modelo `ArcFace` (84 MB), los vídeos de demo, `SystemSounds` y los `.dylib`
de `libimobiledevice`. Recupéralos del commit exacto de upstream:

```bash
cd sapphire-personal
./scripts-personal/restaurar-binarios.sh
```

Sin `ArcFace.mlpackage` el reconocimiento facial no funciona, pero **el resto de
la app sí compila**.

## 2. Comprobar el entorno

```bash
sw_vers                 # macOS 26.x
uname -m                # arm64
xcodebuild -version     # Xcode con SDK de macOS 26
```

Si `xcodebuild` falla, acepta la licencia: `sudo xcodebuild -license accept`.

## 3. Compilar

```bash
cd sapphire-personal
xcodebuild -project Sapphire.xcodeproj -scheme Sapphire \
           -configuration Debug -destination 'platform=macOS,arch=arm64' build
```

La primera compilación fallará en cosas que no he podido ver sin compilador.
Pásame la salida de `xcodebuild` y las arreglo.

Firma: el proyecto trae la configuración del autor original. Para compilar en
local, en Xcode → target *Sapphire* → *Signing & Capabilities*, pon tu propio
equipo o «Sign to Run Locally».

## 4. Permisos que pedirá macOS

Concédelos sólo cuando uses la función correspondiente:

| Permiso | Para qué | Dónde |
|---|---|---|
| Cámara | Reconocimiento facial | Privacidad → Cámara |
| Automatización (Spotify) | Control local de reproducción | Privacidad → Automatización |
| Accesibilidad | Detección de llamadas, gestión de ventanas | Privacidad → Accesibilidad |
| Bluetooth | Desbloqueo por proximidad | Privacidad → Bluetooth |

## 5. Comprobaciones tras compilar

Por orden, y anotando lo que falle:

1. **Face ID sin modelo de liveness** (el caso por defecto): debe **negarse** a
   autenticar y decir que falta el modelo. Si desbloquea, la corrección no está
   surtiendo efecto — avísame.
2. **Registro facial**: mueve la cabeza; los tramos del anillo deben encenderse
   por sectores (arriba, derecha, abajo, izquierda, las dos inclinaciones).
3. **Spotify abierto, música en pausa** → pulsar play debe reanudar de verdad.
4. **Spotify cerrado** → pulsar play no debe dejar la UI en «reproduciendo».
5. **Claro y oscuro**, y con *Reducir movimiento* y *Reducir transparencia*
   activados en Accesibilidad.

## 6. Generar el .app

```bash
xcodebuild -project Sapphire.xcodeproj -scheme Sapphire \
           -configuration Release -derivedDataPath ./build build
open ./build/Build/Products/Release/
```
