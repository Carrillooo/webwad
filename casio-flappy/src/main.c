/*
 * Flappy Casio - clon de Flappy Bird para Casio fx-CG10/20/50 (Prizm)
 *
 * Controles: SHIFT / EXE / flecha arriba = aletear
 *            EXIT = pausa (desde la pausa, MENU sale al menu principal)
 *
 * Toda la fisica usa punto fijo (x256) porque la calculadora no tiene FPU.
 */
#include <fxcg/display.h>
#include <fxcg/keyboard.h>
#include <fxcg/rtc.h>
#include "font.h"

#define W 384
#define H 216

#define RGB(r, g, b) (unsigned short)((((r) >> 3) << 11) | (((g) >> 2) << 5) | ((b) >> 3))

#define C_BLACK     RGB(0, 0, 0)
#define C_WHITE     RGB(255, 255, 255)
#define C_YELLOW    RGB(250, 200, 30)
#define C_YELLOW_D  RGB(220, 150, 20)
#define C_ORANGE    RGB(240, 90, 30)
#define C_WING      RGB(255, 240, 170)
#define C_PIPE      RGB(115, 190, 45)
#define C_PIPE_L    RGB(170, 230, 90)
#define C_PIPE_D    RGB(60, 120, 25)
#define C_PIPE_O    RGB(40, 70, 20)
#define C_GROUND    RGB(222, 216, 148)
#define C_GROUND_D  RGB(200, 190, 120)
#define C_GRASS     RGB(115, 190, 45)
#define C_GRASS_D   RGB(85, 150, 35)
#define C_CLOUD     RGB(240, 250, 250)
#define C_HILL      RGB(130, 210, 120)
#define C_HILL_D    RGB(100, 180, 100)
#define C_CITY      RGB(165, 220, 215)
#define C_PANEL     RGB(222, 216, 148)
#define C_PANEL_B   RGB(84, 56, 71)
#define C_TITLE     RGB(255, 140, 30)

/* ------------------------------------------------------------------ */
/* Teclado en tiempo real (lectura directa de los registros)           */
/* ------------------------------------------------------------------ */

#define K_EXE   31
#define K_UP    28
#define K_EXIT  47
#define K_SHIFT 78
#define K_F1    79
#define K_ALPHA 77

#ifdef SIM
int sim_keydown(int basic_keycode);
#define keydown sim_keydown
#else
static int keydown(int basic_keycode)
{
    const volatile unsigned short *reg = (const volatile unsigned short *)0xA44B0000;
    int row = basic_keycode % 10;
    int col = basic_keycode / 10 - 1;
    int word = row >> 1;
    int bit = col + 8 * (row & 1);
    return (reg[word] & (1 << bit)) != 0;
}
#endif

static int flap_key(void)
{
    return keydown(K_SHIFT) || keydown(K_EXE) || keydown(K_UP) || keydown(K_F1) || keydown(K_ALPHA);
}

/* ------------------------------------------------------------------ */
/* Dibujo                                                              */
/* ------------------------------------------------------------------ */

static unsigned short *vram;

static void rect(int x, int y, int w, int h, unsigned short c)
{
    int i, j;
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    if (x + w > W) w = W - x;
    if (y + h > H) h = H - y;
    if (w <= 0 || h <= 0) return;
    for (j = 0; j < h; j++) {
        unsigned short *p = vram + (y + j) * W + x;
        for (i = 0; i < w; i++) p[i] = c;
    }
}

/* Elipse rellena centrada en (cx,cy) con radios rx, ry */
static void ellipse(int cx, int cy, int rx, int ry, unsigned short c)
{
    int dy;
    long rx2 = (long)rx * rx, ry2 = (long)ry * ry;
    for (dy = -ry; dy <= ry; dy++) {
        /* dx max tal que dx^2/rx^2 + dy^2/ry^2 <= 1 */
        long lim = rx2 * (ry2 - (long)dy * dy);
        int dx = rx;
        while (dx > 0 && (long)dx * dx * ry2 > lim) dx--;
        rect(cx - dx, cy + dy, 2 * dx + 1, 1, c);
    }
}

static void draw_char(int x, int y, unsigned char ch, int scale, unsigned short c)
{
    int row, col;
    const unsigned char *g;
    if (ch < 0x20) return;
    g = font_data[ch - 0x20];
    for (row = 0; row < FONT_H; row++)
        for (col = 0; col < 7; col++)
            if (g[row] & (0x80 >> col))
                rect(x + col * scale, y + row * scale, scale, scale, c);
}

static int text_width(const char *s, int scale)
{
    int n = 0;
    while (s[n]) n++;
    return n * 7 * scale;
}

static void text(int x, int y, const char *s, int scale, unsigned short c)
{
    while (*s) { draw_char(x, y, (unsigned char)*s++, scale, c); x += 7 * scale; }
}

/* Texto con contorno (estilo Flappy) */
static void text_outline(int x, int y, const char *s, int scale, unsigned short fg, unsigned short bg)
{
    int dx, dy, o = scale > 1 ? scale / 2 + 1 : 1;
    for (dy = -o; dy <= o; dy += o)
        for (dx = -o; dx <= o; dx += o)
            if (dx || dy) text(x + dx, y + dy, s, scale, bg);
    text(x, y, s, scale, fg);
}

static void text_center(int y, const char *s, int scale, unsigned short fg, unsigned short bg)
{
    text_outline((W - text_width(s, scale)) / 2, y, s, scale, fg, bg);
}

static void itoa_s(int v, char *buf)
{
    char t[12];
    int n = 0, i = 0;
    if (v == 0) t[n++] = '0';
    while (v > 0) { t[n++] = (char)('0' + v % 10); v /= 10; }
    while (n) buf[i++] = t[--n];
    buf[i] = 0;
}

/* ------------------------------------------------------------------ */
/* Estado del juego                                                    */
/* ------------------------------------------------------------------ */

#define GROUND_Y   192           /* donde empieza el suelo */
#define BIRD_X     90
#define BIRD_RX    11
#define BIRD_RY    8
#define FP         256           /* punto fijo */
#define GRAVITY    (FP * 55 / 100)
#define FLAP_VY    (-FP * 66 / 10)
#define MAX_VY     (FP * 9)

#define NPIPES     3
#define PIPE_W     44
#define PIPE_CAP   6             /* lo que sobresale la boca por cada lado */
#define PIPE_SPACE 150           /* distancia horizontal entre tuberias */
#define GAP_MIN    58

enum { S_TITLE, S_PLAY, S_DYING, S_OVER };

static int state;
static int bird_y;               /* punto fijo */
static int bird_vy;
static int frame;
static int score, best;
static int scroll;               /* desplazamiento acumulado del fondo */
static int pipe_x[NPIPES], pipe_gap_y[NPIPES], pipe_gap_h[NPIPES], pipe_scored[NPIPES];
static int dead_timer;
static int speed;
static int flash;

static unsigned int rnd_state;
static int rnd(int n)
{
    rnd_state = rnd_state * 1103515245u + 12345u;
    return (int)((rnd_state >> 16) % (unsigned)n);
}

static void new_pipe(int i, int x)
{
    int gap = 74 - score / 4;    /* se estrecha poco a poco */
    if (gap < GAP_MIN) gap = GAP_MIN;
    pipe_x[i] = x;
    pipe_gap_h[i] = gap;
    pipe_gap_y[i] = 24 + rnd(GROUND_Y - 48 - gap);
    pipe_scored[i] = 0;
}

static void reset_game(void)
{
    int i;
    bird_y = 100 * FP;
    bird_vy = 0;
    score = 0;
    speed = 2;
    dead_timer = 0;
    for (i = 0; i < NPIPES; i++) new_pipe(i, W + 60 + i * PIPE_SPACE);
}

/* ------------------------------------------------------------------ */
/* Escenario                                                           */
/* ------------------------------------------------------------------ */

static unsigned short sky_row[GROUND_Y];

static void init_sky(void)
{
    int y;
    for (y = 0; y < GROUND_Y; y++) {
        /* degradado de azul cielo a azul claro */
        int r = 78 + (150 - 78) * y / GROUND_Y;
        int g = 192 + (225 - 192) * y / GROUND_Y;
        int b = 202 + (215 - 202) * y / GROUND_Y;
        sky_row[y] = RGB(r, g, b);
    }
}

static void draw_background(void)
{
    int y, i;
    for (y = 0; y < GROUND_Y; y++) {
        unsigned short c = sky_row[y];
        unsigned short *p = vram + y * W;
        int x;
        for (x = 0; x < W; x++) p[x] = c;
    }

    /* nubes (parallax lento) */
    for (i = 0; i < 5; i++) {
        int cx = ((i * 97 + 30) - scroll / 8) % (W + 80);
        if (cx < -40) cx += W + 80;
        cx -= 40;
        ellipse(cx, 120 + (i % 2) * 6, 22, 9, C_CLOUD);
        ellipse(cx + 18, 116 + (i % 2) * 6, 16, 10, C_CLOUD);
        ellipse(cx - 16, 124 + (i % 2) * 6, 14, 7, C_CLOUD);
    }

    /* ciudad (parallax medio) */
    for (i = 0; i < 14; i++) {
        int bx = ((i * 31) - scroll / 4) % (W + 40);
        int bh = 22 + ((i * 37) % 5) * 7;
        if (bx < -30) bx += W + 40;
        rect(bx, GROUND_Y - 22 - bh, 26, bh, C_CITY);
        {
            int wy;
            for (wy = GROUND_Y - 18 - bh; wy < GROUND_Y - 26; wy += 7) {
                rect(bx + 4, wy, 4, 3, sky_row[wy]);
                rect(bx + 15, wy, 4, 3, sky_row[wy]);
            }
        }
    }

    /* arbustos */
    for (i = 0; i < 12; i++) {
        int hx = ((i * 40) - scroll / 2) % (W + 40);
        if (hx < -20) hx += W + 40;
        ellipse(hx, GROUND_Y - 4, 24, 16, C_HILL_D);
        ellipse(hx, GROUND_Y - 2, 21, 13, C_HILL);
    }
}

static void draw_ground(void)
{
    int x;
    int off = scroll % 16;
    rect(0, GROUND_Y, W, 2, C_PIPE_O);
    rect(0, GROUND_Y + 2, W, 8, C_GRASS);
    /* rayas diagonales que se mueven */
    for (x = -16; x < W + 16; x += 16) {
        int k;
        for (k = 0; k < 8; k++) rect(x - off + k, GROUND_Y + 2 + k, 7, 1, C_GRASS_D);
    }
    rect(0, GROUND_Y + 10, W, 2, C_GRASS_D);
    rect(0, GROUND_Y + 12, W, H - GROUND_Y - 12, C_GROUND);
    for (x = -24; x < W + 24; x += 24) rect(x - (scroll % 24), GROUND_Y + 18, 12, 2, C_GROUND_D);
}

static void draw_pipe_body(int x, int y, int h)
{
    if (h <= 0) return;
    rect(x, y, PIPE_W, h, C_PIPE_O);
    rect(x + 2, y, PIPE_W - 4, h, C_PIPE);
    rect(x + 6, y, 5, h, C_PIPE_L);
    rect(x + PIPE_W - 12, y, 6, h, C_PIPE_D);
}

static void draw_pipe_cap(int x, int y)
{
    int cx = x - PIPE_CAP, cw = PIPE_W + 2 * PIPE_CAP;
    rect(cx, y, cw, 14, C_PIPE_O);
    rect(cx + 2, y + 2, cw - 4, 10, C_PIPE);
    rect(cx + 6, y + 2, 5, 10, C_PIPE_L);
    rect(cx + cw - 12, y + 2, 6, 10, C_PIPE_D);
}

static void draw_pipes(void)
{
    int i;
    for (i = 0; i < NPIPES; i++) {
        int x = pipe_x[i];
        int top = pipe_gap_y[i];
        int bot = top + pipe_gap_h[i];
        if (x > W + PIPE_CAP || x + PIPE_W + PIPE_CAP < 0) continue;
        draw_pipe_body(x, 0, top - 14);
        draw_pipe_cap(x, top - 14);
        draw_pipe_cap(x, bot);
        draw_pipe_body(x, bot + 14, GROUND_Y - bot - 14);
    }
}

static void draw_bird(int cx, int cy)
{
    int wing = (frame / 3) % 4;   /* 0 arriba, 1 medio, 2 abajo, 3 medio */
    int wy;
    if (state == S_DYING || state == S_OVER) wing = 1;
    wy = wing == 0 ? -4 : wing == 2 ? 4 : 0;

    ellipse(cx, cy, BIRD_RX + 1, BIRD_RY + 1, C_BLACK);
    ellipse(cx, cy, BIRD_RX, BIRD_RY, C_YELLOW);
    ellipse(cx - 1, cy + 4, BIRD_RX - 3, 3, C_YELLOW_D);       /* barriga */
    /* ojo */
    ellipse(cx + 5, cy - 3, 5, 5, C_BLACK);
    ellipse(cx + 5, cy - 3, 4, 4, C_WHITE);
    rect(cx + 6, cy - 4, 2, 3, C_BLACK);
    /* pico */
    rect(cx + 5, cy + 1, 10, 6, C_BLACK);
    rect(cx + 6, cy + 2, 8, 2, C_ORANGE);
    rect(cx + 6, cy + 4, 7, 2, RGB(220, 70, 20));
    /* ala */
    ellipse(cx - 6, cy + wy, 6, 4, C_BLACK);
    ellipse(cx - 6, cy + wy, 5, 3, C_WING);
}

static void draw_score_big(int y)
{
    char buf[12];
    itoa_s(score, buf);
    text_center(y, buf, 3, C_WHITE, C_BLACK);
}

static const char *medal_name(int s, unsigned short *c)
{
    if (s >= 40) { *c = RGB(230, 230, 255); return "PLATINO"; }
    if (s >= 30) { *c = RGB(255, 210, 40); return "ORO"; }
    if (s >= 20) { *c = RGB(200, 200, 210); return "PLATA"; }
    if (s >= 10) { *c = RGB(205, 127, 50); return "BRONCE"; }
    *c = 0;
    return 0;
}

static void draw_game_over(void)
{
    char buf[16];
    int px = (W - 200) / 2, py = 70;
    unsigned short mc;
    const char *medal = medal_name(score, &mc);

    text_center(28, "GAME OVER", 3, C_TITLE, C_WHITE);

    rect(px - 3, py - 3, 206, 96, C_PANEL_B);
    rect(px, py, 200, 90, C_PANEL);
    rect(px + 4, py + 4, 192, 82, RGB(232, 226, 165));

    /* medalla */
    text(px + 16, py + 10, "MEDALLA", 1, C_ORANGE);
    if (medal) {
        ellipse(px + 40, py + 52, 22, 22, C_PANEL_B);
        ellipse(px + 40, py + 52, 20, 20, mc);
        ellipse(px + 40, py + 52, 13, 13, C_WHITE);
        ellipse(px + 40, py + 52, 11, 11, mc);
        text(px + 40 - text_width(medal, 1) / 2, py + 76, medal, 1, C_PANEL_B);
    } else {
        ellipse(px + 40, py + 52, 20, 20, RGB(210, 200, 140));
        text(px + 34, py + 46, "-", 1, C_PANEL_B);
    }

    text(px + 110, py + 10, "PUNTOS", 1, C_ORANGE);
    itoa_s(score, buf);
    text_outline(px + 186 - text_width(buf, 2), py + 24, buf, 2, C_WHITE, C_BLACK);
    text(px + 110, py + 48, "RECORD", 1, C_ORANGE);
    itoa_s(best, buf);
    text_outline(px + 186 - text_width(buf, 2), py + 62, buf, 2, C_WHITE, C_BLACK);
    if (score == best && score > 0) {
        rect(px + 100, py + 64, 34, 12, RGB(230, 50, 50));
        text(px + 103, py + 64, "NEW", 1, C_WHITE);
    }

    if (dead_timer > 40 && (frame / 10) % 2 == 0)
        text_center(176, "Pulsa SHIFT para jugar otra vez", 1, C_WHITE, C_BLACK);
}

static void draw_title(void)
{
    text_center(30, "Flappy Casio", 4, C_TITLE, C_WHITE);
    if ((frame / 12) % 2 == 0)
        text_center(130, "Pulsa SHIFT o EXE para volar", 1, C_WHITE, C_BLACK);
    text_center(150, "EXIT: pausa    MENU (en pausa): salir", 1, C_WHITE, C_BLACK);
    if (best > 0) {
        char buf[24] = "Record: ";
        itoa_s(best, buf + 8);
        text_center(100, buf, 1, C_WHITE, C_BLACK);
    }
}

static void draw_frame(void)
{
    int by = bird_y / FP;
    draw_background();
    draw_pipes();
    draw_ground();
    draw_bird(BIRD_X, by);

    if (state == S_TITLE) draw_title();
    else if (state == S_OVER) draw_game_over();
    else draw_score_big(12);

    if (flash > 0) {
        /* destello blanco al chocar */
        rect(0, 0, W, H, C_WHITE);
        flash--;
    }
}

/* ------------------------------------------------------------------ */
/* Logica                                                              */
/* ------------------------------------------------------------------ */

static int collides(void)
{
    int i;
    int by = bird_y / FP;
    int top = by - BIRD_RY + 1, bot = by + BIRD_RY - 1;
    int left = BIRD_X - BIRD_RX + 2, right = BIRD_X + BIRD_RX + 2;
    if (bot >= GROUND_Y) return 1;
    for (i = 0; i < NPIPES; i++) {
        int px0 = pipe_x[i] - PIPE_CAP + 2, px1 = pipe_x[i] + PIPE_W + PIPE_CAP - 2;
        if (right < px0 || left > px1) continue;
        if (top < pipe_gap_y[i] || bot > pipe_gap_y[i] + pipe_gap_h[i]) return 1;
    }
    return 0;
}

static void update(int flap_pressed)
{
    int i;
    frame++;

    switch (state) {
    case S_TITLE:
        scroll += speed;
        bird_y = (100 + ((frame / 4) % 8 < 4 ? (frame / 4) % 4 : 4 - (frame / 4) % 4) * 2) * FP;
        if (flap_pressed) {
            reset_game();
            state = S_PLAY;
            bird_vy = FLAP_VY;
        }
        break;

    case S_PLAY:
        scroll += speed;
        if (flap_pressed) bird_vy = FLAP_VY;
        bird_vy += GRAVITY;
        if (bird_vy > MAX_VY) bird_vy = MAX_VY;
        bird_y += bird_vy;
        if (bird_y < -20 * FP) { bird_y = -20 * FP; bird_vy = 0; }

        for (i = 0; i < NPIPES; i++) {
            pipe_x[i] -= speed;
            if (!pipe_scored[i] && pipe_x[i] + PIPE_W < BIRD_X) {
                pipe_scored[i] = 1;
                score++;
            }
            if (pipe_x[i] + PIPE_W + PIPE_CAP < 0) {
                /* reciclar detras de la ultima */
                int maxx = 0, j;
                for (j = 0; j < NPIPES; j++) if (pipe_x[j] > maxx) maxx = pipe_x[j];
                new_pipe(i, maxx + PIPE_SPACE);
            }
        }
        if (score >= 15) speed = 3;

        if (collides()) {
            state = S_DYING;
            flash = 2;
            if (bird_vy < 0) bird_vy = 0;
            if (score > best) best = score;
        }
        break;

    case S_DYING:
        bird_vy += GRAVITY;
        if (bird_vy > MAX_VY) bird_vy = MAX_VY;
        bird_y += bird_vy;
        if (bird_y / FP + BIRD_RY >= GROUND_Y) {
            bird_y = (GROUND_Y - BIRD_RY) * FP;
            state = S_OVER;
            dead_timer = 0;
        }
        break;

    case S_OVER:
        dead_timer++;
        if (dead_timer > 40 && flap_pressed) {
            reset_game();
            state = S_TITLE;
        }
        break;
    }
}

/* Pausa: usa GetKey para que MENU funcione con normalidad */
static void pause_menu(void)
{
    int key;
    draw_frame();
    rect(W / 2 - 110, 70, 220, 70, C_PANEL_B);
    rect(W / 2 - 107, 73, 214, 64, C_PANEL);
    text_center(80, "PAUSA", 2, C_WHITE, C_BLACK);
    text_center(110, "EXIT: seguir   MENU: salir", 1, C_PANEL_B, C_PANEL);
    Bdisp_PutDisp_DD();
    for (;;) {
        GetKey(&key);
        if (key == KEY_CTRL_EXIT || key == KEY_CTRL_EXE) break;
    }
    /* esperar a soltar la tecla */
    while (keydown(K_EXIT) || flap_key()) {}
}

int main(int isAppli, unsigned short optionNum)
{
    int prev_flap = 0, latched = 0;
    int t_next;
    (void)isAppli;
    (void)optionNum;

    vram = (unsigned short *)GetVRAMAddress();
    Bdisp_EnableColor(1);
    EnableStatusArea(3); /* pantalla completa */
    rnd_state = (unsigned int)RTC_GetTicks();
    init_sky();
    best = 0;
    reset_game();
    state = S_TITLE;

    t_next = RTC_GetTicks();
    for (;;) {
        int f = flap_key();
        int pressed = latched || (f && !prev_flap);   /* solo al pulsar, no al mantener */
        prev_flap = f;
        latched = 0;

        if (keydown(K_EXIT)) {
            pause_menu();
            prev_flap = 1;
            t_next = RTC_GetTicks();
        }

        update(pressed);
        draw_frame();
        Bdisp_PutDisp_DD();

        /* ~32 fotogramas por segundo (el RTC cuenta a 128 Hz) */
        t_next += 4;
        while (RTC_GetTicks() < t_next) {
            /* seguir leyendo el teclado mientras esperamos: no perder toques rapidos */
            int g = flap_key();
            if (g && !prev_flap) latched = 1;
            prev_flap = g;
        }
        if (RTC_GetTicks() > t_next + 16) t_next = RTC_GetTicks(); /* si vamos tarde, no acumular */
    }
    return 0;
}
