# Flappy Casio - add-in .g3a para Casio fx-CG10/20/50 (Prizm)
# Usa las mismas dependencias que CasioIA (ejecuta antes ../casio-ia/build.sh)

PREFIX  ?= sh-elf-
LIBFXCG ?= ../casio-ia/deps/libfxcg
MKG3A   ?= ../casio-ia/deps/mkg3a/build/src/mkg3a

CC      = $(PREFIX)gcc
CFLAGS  = -m4a-nofpu -mb -mdiv=call-div1 -O2 -Wall -ffreestanding -fno-builtin \
          -ffunction-sections -fdata-sections -I$(LIBFXCG)/include -Isrc
LDFLAGS = -m4a-nofpu -mb -nostdlib -nostartfiles -T$(LIBFXCG)/toolchain/prizm.x \
          -Wl,-static -Wl,-gc-sections -L$(LIBFXCG)/libfxcg

ADDIN   = FlappyCasio

all: $(ADDIN).g3a

build/main.o: src/main.c src/font.h Makefile
	@mkdir -p build
	$(CC) $(CFLAGS) -c $< -o $@

build/$(ADDIN).bin: build/main.o
	$(CC) $(LDFLAGS) -o $@ $^ -lfxcg -lgcc

$(ADDIN).g3a: build/$(ADDIN).bin res/icon_uns.png res/icon_sel.png
	$(MKG3A) -n basic:Flappy -n es:Flappy -n en:Flappy \
	  -i uns:res/icon_uns.png -i sel:res/icon_sel.png $< $@

clean:
	rm -rf build $(ADDIN).g3a

.PHONY: all clean
