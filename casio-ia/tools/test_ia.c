/* Prueba del motor en el PC: gcc -Isrc tools/test_ia.c src/ia.c -o test_ia */
#include <stdio.h>
#include <string.h>
#include "ia.h"
int ia_hora(int *h, int *m) { *h = 17; *m = 5; return 1; }
int main(void)
{
    char line[256], out[IA_MAX_RESP];
    ia_iniciar(42);
    while (fgets(line, sizeof line, stdin)) {
        line[strcspn(line, "\n")] = 0;
        ia_responder(line, out, sizeof out);
        printf("> %s\n  %s\n", line, out);
    }
    return 0;
}
