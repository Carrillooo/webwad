#!/bin/sh
# Prepara dependencias (libfxcg + mkg3a) y compila CasioIA.g3a
set -e
cd "$(dirname "$0")"
mkdir -p deps
if [ ! -d deps/libfxcg ]; then
  git clone --depth 1 https://github.com/Jonimoose/libfxcg.git deps/libfxcg
fi
if [ ! -f deps/libfxcg/libfxcg/libfxcg.a ]; then
  make -C deps/libfxcg/libfxcg TOOLCHAIN_PREFIX=sh-elf-
fi
if [ ! -x deps/mkg3a/build/src/mkg3a ]; then
  [ -d deps/mkg3a ] || git clone --depth 1 https://gitlab.com/taricorp/mkg3a.git deps/mkg3a
  # mkg3a pide CMake 3.31, pero compila bien con versiones anteriores
  find deps/mkg3a -name CMakeLists.txt -exec sed -i 's/VERSION 3\.31/VERSION 3.20/; s/3\.31/3.20/' {} \;
  mkdir -p deps/mkg3a/build
  (cd deps/mkg3a/build && cmake .. >/dev/null && make mkg3a)
fi
make
