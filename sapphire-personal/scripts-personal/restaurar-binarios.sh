#!/usr/bin/env bash
# Restaura los binarios de upstream que no se versionan en este subdirectorio.
#
# Para no meter 158 MB de binarios en el repositorio de webwad, la vendorización
# excluyó los ficheros grandes. Este script los recupera del commit exacto de
# upstream sobre el que se hizo la copia.
set -euo pipefail

UPSTREAM="https://github.com/cshariq/Sapphire.git"
COMMIT="798d117"                      # commit vendorizado (2026-09-16)
DEST="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Clonando upstream en $TMP…"
git clone --filter=blob:none --no-checkout "$UPSTREAM" "$TMP/sapphire"
git -C "$TMP/sapphire" checkout "$COMMIT"

# Rutas excluidas de la vendorización.
PATHS=(
  "Sapphire/Services/FaceID/Models/ArcFace.mlpackage"   # 84 MB: modelo de reconocimiento
  "SystemSounds"                                        # 9.8 MB
  "Assets"                                              # vídeos .mp4/.mov de demo
  "libimobiledevice"                                    # .dylib
)

for p in "${PATHS[@]}"; do
  if [ -e "$TMP/sapphire/$p" ]; then
    echo "Restaurando $p…"
    mkdir -p "$DEST/$(dirname "$p")"
    cp -R "$TMP/sapphire/$p" "$DEST/$(dirname "$p")/"
  else
    echo "AVISO: $p no existe en upstream@$COMMIT" >&2
  fi
done

echo
echo "Hecho. Nota: el modelo de liveness (PassiveLiveness) NO está en upstream:"
echo "se descarga/descifra en tiempo de ejecución con la clave del autor original."
echo "Sin ese modelo, la autenticación facial queda deshabilitada a propósito"
echo "(fail-closed). Ver DOCS-ES/AUDITORIA.md."
