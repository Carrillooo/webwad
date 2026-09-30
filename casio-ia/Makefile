# CasioIA - add-in .g3a para Casio fx-CG10/20/50 (Prizm)
#
# Requisitos:
#   - GCC para SuperH:   sudo apt install gcc-sh-elf binutils-sh-elf
#   - libfxcg compilada: https://github.com/Jonimoose/libfxcg
#   - mkg3a:             https://gitlab.com/taricorp/mkg3a
# El script build.sh descarga y prepara libfxcg y mkg3a automaticamente.

PREFIX  ?= sh-elf-
LIBFXCG ?= deps/libfxcg
MKG3A   ?= deps/mkg3a/build/src/mkg3a

CC      = $(PREFIX)gcc
CFLAGS  = -m4a-nofpu -mb -mdiv=call-div1 -Os -Wall -ffreestanding -fno-builtin \
          -ffunction-sections -fdata-sections -I$(LIBFXCG)/include -Isrc
LDFLAGS = -m4a-nofpu -mb -nostdlib -nostartfiles -T$(LIBFXCG)/toolchain/prizm.x \
          -Wl,-static -Wl,-gc-sections -L$(LIBFXCG)/lib -L$(LIBFXCG)/libfxcg

ADDIN   = CasioIA
OBJS    = build/main.o build/ia.o

all: $(ADDIN).g3a

build/%.o: src/%.c src/ia.h src/font.h
	@mkdir -p build
	$(CC) $(CFLAGS) -c $< -o $@

build/$(ADDIN).bin: $(OBJS)
	$(CC) $(LDFLAGS) -o $@ $(OBJS) -lfxcg -lgcc

$(ADDIN).g3a: build/$(ADDIN).bin res/icon_uns.png res/icon_sel.png
	$(MKG3A) -n basic:CasioIA -n es:CasioIA -n en:CasioIA \
	  -i uns:res/icon_uns.png -i sel:res/icon_sel.png $< $@

# prueba del motor de conversacion en el PC
test: tools/test_ia.c src/ia.c src/ia.h
	@mkdir -p build
	gcc -Wall -O1 -Isrc tools/test_ia.c src/ia.c -o build/test_ia
	./build/test_ia

clean:
	rm -rf build $(ADDIN).g3a

.PHONY: all clean test
