/*
 * CasioIA - chat "inteligente" offline para Casio fx-CG10/20/50 (Prizm)
 *
 * Interfaz: registro de conversacion con scroll, linea de escritura y
 * barra de teclas F. El "cerebro" esta en ia.c.
 */
#include <fxcg/display.h>
#include <fxcg/keyboard.h>
#include <fxcg/system.h>
#include <fxcg/rtc.h>
#include "font.h"
#include "ia.h"

#define SCR_W 384
#define SCR_H 216

#define CHAR_W 7
#define LINE_H 13
#define MARGIN 3
#define COLS ((SCR_W - 2 * MARGIN - 6) / CHAR_W) /* 6 px para la barra de scroll */

#define CHAT_Y 24                 /* debajo de la barra de estado del SO */
#define INPUT_Y 180
#define FKEY_Y 199
#define CHAT_LINES ((INPUT_Y - CHAT_Y - 2) / LINE_H)

#define RGB(r, g, b) (unsigned short)((((r) >> 3) << 11) | (((g) >> 2) << 5) | ((b) >> 3))

#define C_BG      RGB(250, 250, 252)
#define C_USER    RGB(20, 60, 170)
#define C_BOT     RGB(0, 110, 60)
#define C_INFO    RGB(120, 120, 120)
#define C_BAR     RGB(30, 40, 70)
#define C_BARTXT  RGB(255, 255, 255)
#define C_INPUTBG RGB(255, 255, 255)
#define C_BORDER  RGB(90, 110, 160)
#define C_TEXT    RGB(0, 0, 0)
#define C_CURSOR  RGB(220, 40, 40)
#define C_FKEY    RGB(60, 80, 130)
#define C_SCROLL  RGB(170, 180, 200)

/* ------------------------------------------------------------------ */
/* Dibujo                                                              */
/* ------------------------------------------------------------------ */

static unsigned short *vram;

static void fill_rect(int x, int y, int w, int h, unsigned short c)
{
    int i, j;
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    if (x + w > SCR_W) w = SCR_W - x;
    if (y + h > SCR_H) h = SCR_H - y;
    for (j = 0; j < h; j++) {
        unsigned short *p = vram + (y + j) * SCR_W + x;
        for (i = 0; i < w; i++) p[i] = c;
    }
}

static void draw_char(int x, int y, unsigned char ch, unsigned short c)
{
    int row, col;
    const unsigned char *g;
    if (ch < 0x20) return;
    g = font_data[ch - 0x20];
    for (row = 0; row < FONT_H; row++) {
        unsigned char bits = g[row];
        int py = y + row;
        if (!bits || py < 0 || py >= SCR_H) continue;
        for (col = 0; col < CHAR_W; col++) {
            int px = x + col;
            if ((bits & (0x80 >> col)) && px >= 0 && px < SCR_W)
                vram[py * SCR_W + px] = c;
        }
    }
}

/* Dibuja texto Latin-1 */
static void draw_text(int x, int y, const char *s, unsigned short c)
{
    while (*s) {
        draw_char(x, y, (unsigned char)*s++, c);
        x += CHAR_W;
    }
}

/* ------------------------------------------------------------------ */
/* Historial del chat (lineas ya partidas al ancho de pantalla)        */
/* ------------------------------------------------------------------ */

#define MAX_LINES 160

typedef struct {
    char text[COLS + 1];
    unsigned short color;
} Line;

static Line lines[MAX_LINES];
static int nlines = 0;
static int scroll = 0; /* lineas desplazadas hacia arriba desde el final */

static void push_line(const char *s, int len, unsigned short color)
{
    int i;
    if (nlines == MAX_LINES) {
        for (i = 1; i < MAX_LINES; i++) lines[i - 1] = lines[i];
        nlines--;
    }
    for (i = 0; i < len && i < COLS; i++) lines[nlines].text[i] = s[i];
    lines[nlines].text[i] = 0;
    lines[nlines].color = color;
    nlines++;
}

/* Convierte UTF-8 a Latin-1 (lo que tiene la fuente); translitera algunos
 * simbolos matematicos y descarta el resto (emojis, etc.) */
static const char *translit(unsigned int c)
{
    static char d[2];
    if (c >= 0x2080 && c <= 0x2089) { d[0] = (char)('0' + c - 0x2080); d[1] = 0; return d; }
    switch (c) {
    case 0x03C0: return "pi";
    case 0x03C1: return "rho";
    case 0x221A: return "raiz";
    case 0x2192: return "->";
    case 0x2014: case 0x2013: return "-";
    case 0x2248: return "~";
    case 0x2018: case 0x2019: return "'";
    case 0x201C: case 0x201D: return "\"";
    case 0x2026: return "...";
    }
    return "";
}

static void utf8_to_latin1(const char *in, char *out, int max)
{
    int n = 0;
    const unsigned char *p = (const unsigned char *)in;
    while (*p && n < max - 1) {
        unsigned int c = *p;
        if (c < 0x80) {
            p++;
        } else if ((c & 0xE0) == 0xC0 && p[1]) {
            c = ((c & 0x1F) << 6) | (p[1] & 0x3F);
            p += 2;
        } else if ((c & 0xF0) == 0xE0 && p[1] && p[2]) {
            c = ((c & 0x0F) << 12) | ((p[1] & 0x3F) << 6) | (p[2] & 0x3F);
            p += 3;
        } else {
            p++;
            while ((*p & 0xC0) == 0x80) p++;
            c = 0x1F600; /* emoji: descartar */
        }
        if (c <= 0xFF) {
            out[n++] = (char)c;
        } else {
            const char *t = translit(c);
            while (*t && n < max - 1) out[n++] = *t++;
        }
    }
    out[n] = 0;
}

/* Anade un mensaje con ajuste de linea por palabras */
static void add_message(const char *prefix, const char *msg_utf8, unsigned short color)
{
    static char buf[IA_MAX_RESP + 64];
    char full[IA_MAX_RESP + 80];
    int len, pos, i;

    utf8_to_latin1(msg_utf8, buf, sizeof(buf));
    /* prefijo + mensaje */
    len = 0;
    for (i = 0; prefix[i]; i++) full[len++] = prefix[i];
    for (i = 0; buf[i] && len < (int)sizeof(full) - 1; i++) full[len++] = buf[i];
    full[len] = 0;

    pos = 0;
    while (pos < len) {
        int start = pos, end, cut;
        /* los saltos de linea explicitos se respetan */
        end = start;
        while (end < len && full[end] != '\n' && end - start < COLS) end++;
        if (end < len && full[end] != '\n' && end - start == COLS) {
            /* buscar espacio para cortar */
            cut = end;
            while (cut > start && full[cut] != ' ') cut--;
            if (cut > start) end = cut;
        }
        push_line(full + start, end - start, color);
        pos = end;
        if (pos < len && (full[pos] == ' ' || full[pos] == '\n')) pos++;
        /* sangria para continuaciones */
    }
    scroll = 0;
}

static void add_blank(void) { push_line("", 0, C_TEXT); }

/* ------------------------------------------------------------------ */
/* Entrada de texto                                                    */
/* ------------------------------------------------------------------ */

#define INPUT_MAX 120

static char input[INPUT_MAX + 1];
static int input_len = 0;
static int cursor = 0;

enum { MODE_LOWER, MODE_UPPER, MODE_NUM };
static int mode = MODE_LOWER;

static const char *mode_name[] = { "abc", "ABC", "123" };

static void insert_str(const char *s)
{
    while (*s && input_len < INPUT_MAX) {
        int i;
        for (i = input_len; i > cursor; i--) input[i] = input[i - 1];
        input[cursor++] = *s++;
        input_len++;
    }
    input[input_len] = 0;
}

static void insert_char(char c)
{
    char s[2];
    s[0] = c;
    s[1] = 0;
    insert_str(s);
}

static void delete_char(void)
{
    int i;
    if (cursor == 0) return;
    for (i = cursor - 1; i < input_len - 1; i++) input[i] = input[i + 1];
    input_len--;
    cursor--;
    input[input_len] = 0;
}

/* Traduce las teclas matematicas de la calculadora a texto */
static const char *key_to_text(int key)
{
    switch (key) {
    case KEY_CHAR_PLUS:     return "+";
    case KEY_CHAR_MINUS:    return "-";
    case KEY_CHAR_PMINUS:   return "-";
    case KEY_CHAR_MULT:     return "*";
    case KEY_CHAR_DIV:      return "/";
    case KEY_CHAR_POW:      return "^";
    case KEY_CHAR_SQUARE:   return "^2";
    case KEY_CHAR_ROOT:     return "raiz(";
    case KEY_CHAR_PI:       return "pi";
    case KEY_CHAR_SIN:      return "sin(";
    case KEY_CHAR_COS:      return "cos(";
    case KEY_CHAR_TAN:      return "tan(";
    case KEY_CHAR_LOG:      return "log(";
    case KEY_CHAR_LN:       return "ln(";
    case KEY_CHAR_EXP:      return "e";
    case KEY_CHAR_FRAC:     return "/";
    case KEY_CHAR_EQUAL:    return "=";
    case KEY_CHAR_DQUATE:   return "\"";
    case KEY_CHAR_THETA:    return "o";
    case KEY_CHAR_VALR:     return "r";
    case KEY_CHAR_LBRCKT:   return "(";
    case KEY_CHAR_RBRCKT:   return ")";
    case KEY_CHAR_LBRACE:   return "(";
    case KEY_CHAR_RBRACE:   return ")";
    }
    return 0;
}

/* ------------------------------------------------------------------ */
/* Pantalla completa                                                   */
/* ------------------------------------------------------------------ */

static void draw_fkeys(void)
{
    static const char *labels[6];
    int i, w = SCR_W / 6;
    labels[0] = mode_name[mode];
    labels[1] = "?";
    labels[2] = "!";
    labels[3] = ",";
    labels[4] = "Borrar";
    labels[5] = "Espacio";
    fill_rect(0, FKEY_Y - 1, SCR_W, SCR_H - FKEY_Y + 1, C_BG);
    for (i = 0; i < 6; i++) {
        int x = i * w + 2;
        const char *l = labels[i];
        int len = 0;
        while (l[len]) len++;
        fill_rect(x, FKEY_Y, w - 4, 16, i == 0 ? C_USER : C_FKEY);
        draw_text(x + (w - 4 - len * CHAR_W) / 2, FKEY_Y + 2, l, C_BARTXT);
    }
}

static void draw_screen(void)
{
    int i, first, y;

    fill_rect(0, CHAT_Y, SCR_W, SCR_H - CHAT_Y, C_BG);

    /* registro */
    first = nlines - CHAT_LINES - scroll;
    if (first < 0) first = 0;
    y = CHAT_Y + 1;
    for (i = first; i < nlines && i < first + CHAT_LINES; i++) {
        draw_text(MARGIN, y, lines[i].text, lines[i].color);
        y += LINE_H;
    }

    /* barra de scroll */
    if (nlines > CHAT_LINES) {
        int track = CHAT_LINES * LINE_H;
        int th = track * CHAT_LINES / nlines;
        int top = first * track / nlines;
        if (th < 6) th = 6;
        fill_rect(SCR_W - 5, CHAT_Y + 1, 3, track, RGB(225, 228, 235));
        fill_rect(SCR_W - 5, CHAT_Y + 1 + top, 3, th, C_SCROLL);
    }

    /* caja de entrada */
    fill_rect(0, INPUT_Y - 2, SCR_W, 1, C_BORDER);
    fill_rect(2, INPUT_Y, SCR_W - 4, 17, C_BORDER);
    fill_rect(3, INPUT_Y + 1, SCR_W - 6, 15, C_INPUTBG);
    {
        int vis = COLS - 3;
        int off = 0;
        char tmp[INPUT_MAX + 1];
        int n;
        if (cursor > vis) off = cursor - vis;
        for (n = 0; n < vis && off + n < input_len; n++) tmp[n] = input[off + n];
        tmp[n] = 0;
        draw_text(6, INPUT_Y + 2, ">", C_CURSOR);
        draw_text(6 + 2 * CHAR_W, INPUT_Y + 2, tmp, C_TEXT);
        fill_rect(6 + 2 * CHAR_W + (cursor - off) * CHAR_W - 1, INPUT_Y + 2, 2, 13, C_CURSOR);
        if (input_len == 0)
            draw_text(6 + 3 * CHAR_W, INPUT_Y + 2, "Escribe aqu\xed y pulsa EXE...", C_INFO);
    }

    draw_fkeys();
}

/* ------------------------------------------------------------------ */

int ia_hora(int *h, int *m)
{
    unsigned int hh, mm, ss, ms;
    RTC_GetTime(&hh, &mm, &ss, &ms);
    if (hh > 23 || mm > 59) return 0;
    *h = (int)hh;
    *m = (int)mm;
    return 1;
}

static void set_alpha_mode(void)
{
    /* 0x14 = estado SHIFT/ALPHA: 0x84 alpha lock (mayus), 0x88 alpha lock (minus) */
    if (mode == MODE_LOWER) SetSetupSetting(0x14, 0x88);
    else if (mode == MODE_UPPER) SetSetupSetting(0x14, 0x84);
    else SetSetupSetting(0x14, 0);
}

static void send_input(void)
{
    static char resp[IA_MAX_RESP];
    if (input_len == 0) return;
    add_message("T\xfa: ", input, C_USER);
    ia_responder(input, resp, sizeof(resp));
    add_message("IA: ", resp, C_BOT);
    add_blank();
    input_len = 0;
    cursor = 0;
    input[0] = 0;
}

int main(int isAppli, unsigned short optionNum)
{
    int key;
    char status_color1 = TEXT_COLOR_WHITE, status_color2 = TEXT_COLOR_BLUE;
    (void)isAppli;
    (void)optionNum;

    vram = (unsigned short *)GetVRAMAddress();
    Bdisp_EnableColor(1);
    DefineStatusAreaFlags(3, SAF_BATTERY | SAF_TEXT | SAF_GLYPH | SAF_ALPHA_SHIFT,
                          &status_color1, &status_color2);
    DefineStatusMessage((char *)"CasioIA - chat offline", 1, 0, 0);

    ia_iniciar(RTC_GetTicks());

    add_message("IA: ", "¡Hola! Soy CasioIA, tu asistente de bolsillo. "
                        "Escribe algo y pulsa EXE. Escribe \"ayuda\" para ver lo que sé hacer.",
                C_BOT);
    add_message("", "[F1: abc/ABC/123 | flechas: scroll | AC: borra | MENU: salir]", C_INFO);
    add_blank();

    for (;;) {
        Bdisp_AllClr_VRAM();
        draw_screen();
        DisplayStatusArea();
        set_alpha_mode();
        GetKey(&key);

        if (key == KEY_CTRL_EXE) {
            send_input();
        } else if (key == KEY_CTRL_DEL) {
            delete_char();
        } else if (key == KEY_CTRL_AC) {
            input_len = cursor = 0;
            input[0] = 0;
        } else if (key == KEY_CTRL_LEFT) {
            if (cursor > 0) cursor--;
        } else if (key == KEY_CTRL_RIGHT) {
            if (cursor < input_len) cursor++;
        } else if (key == KEY_CTRL_UP) {
            if (nlines - CHAT_LINES - scroll > 0) scroll++;
        } else if (key == KEY_CTRL_DOWN) {
            if (scroll > 0) scroll--;
        } else if (key == KEY_CTRL_F1) {
            mode = (mode + 1) % 3;
        } else if (key == KEY_CTRL_F2) {
            insert_char('?');
        } else if (key == KEY_CTRL_F3) {
            insert_char('!');
        } else if (key == KEY_CTRL_F4) {
            insert_char(',');
        } else if (key == KEY_CTRL_F5) {
            nlines = 0;
            scroll = 0;
            add_message("IA: ", "Chat borrado. ¿De qué hablamos ahora?", C_BOT);
            add_blank();
        } else if (key == KEY_CTRL_F6) {
            insert_char(' ');
        } else if (key >= 0x20 && key < 0x7F) {
            insert_char((char)key);
        } else {
            const char *t = key_to_text(key);
            if (t) insert_str(t);
        }
    }
    return 0;
}
