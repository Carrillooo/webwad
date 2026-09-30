/*
 * CasioIA - motor de conversacion offline.
 *
 * No hay red en la calculadora, asi que la "IA" combina:
 *   - una calculadora en lenguaje natural ("cuanto es 3 por 4 mas 2")
 *   - un resolvedor de ecuaciones en x ("2x+3=11", "x^2-5x+6=0")
 *   - una base de conocimiento con reglas por palabras clave
 *   - memoria de la conversacion (tu nombre, tu edad, lo que te gusta)
 *   - juegos: adivinar un numero, piedra-papel-tijera, adivinanzas
 *   - respuestas estilo ELIZA cuando no entiende
 *
 * Todo en C sin libc para que funcione en el SH4 de la Prizm.
 */
#include "ia.h"

/* ------------------------------------------------------------------ */
/* Utilidades de cadenas                                               */
/* ------------------------------------------------------------------ */

static int s_len(const char *s) { int n = 0; while (s[n]) n++; return n; }

static int s_eq(const char *a, const char *b)
{
    while (*a && *a == *b) { a++; b++; }
    return *a == *b;
}

static int s_prefix(const char *s, const char *p)
{
    while (*p) if (*s++ != *p++) return 0;
    return 1;
}

static void s_copy(char *d, const char *s, int max)
{
    int i = 0;
    while (s[i] && i < max - 1) { d[i] = s[i]; i++; }
    d[i] = 0;
}

/* Salida con limite */
static char *out_buf;
static int out_len, out_max;

static void out_reset(char *buf, int max) { out_buf = buf; out_len = 0; out_max = max; buf[0] = 0; }

static void out_s(const char *s)
{
    while (*s && out_len < out_max - 1) out_buf[out_len++] = *s++;
    out_buf[out_len] = 0;
}

static void out_int(long v)
{
    char t[16];
    int n = 0;
    unsigned long u;
    if (v < 0) { out_s("-"); u = (unsigned long)(-v); } else u = (unsigned long)v;
    do { t[n++] = (char)('0' + u % 10); u /= 10; } while (u);
    while (n--) { char c[2]; c[0] = t[n]; c[1] = 0; out_s(c); }
}

/* ------------------------------------------------------------------ */
/* Aleatorio                                                           */
/* ------------------------------------------------------------------ */

static unsigned int rnd_state = 12345;

static unsigned int rnd(void)
{
    rnd_state = rnd_state * 1103515245u + 12345u;
    return (rnd_state >> 16) & 0x7FFF;
}

static int rnd_range(int a, int b) /* incluye ambos */
{
    if (b < a) { int t = a; a = b; b = t; }
    return a + (int)(rnd() % (unsigned)(b - a + 1));
}

/* ------------------------------------------------------------------ */
/* Matematicas sin libm                                                */
/* ------------------------------------------------------------------ */

#define M_PI_ 3.14159265358979323846
#define M_E_  2.71828182845904523536
#define M_LN2 0.69314718055994530942

static int m_isnan(double x) { return x != x; }
static int m_isinf(double x) { return !m_isnan(x) && (x > 1e300|| x < -1e300); }
static double m_abs(double x) { return x < 0 ? -x : x; }
static double m_nan(void) { double z = 0.0; return z / z; }

static double m_floor(double x)
{
    long long i;
    if (x > 9e18|| x < -9e18) return x;
    i = (long long)x;
    if ((double)i > x) i--;
    return (double)i;
}

static double m_sqrt(double x)
{
    double g;
    int i;
    if (x < 0) return m_nan();
    if (x == 0) return 0;
    g = x > 1 ? x / 2 : 1;
    for (i = 0; i < 60; i++) {
        double n = 0.5 * (g + x / g);
        if (n == g) break;
        g = n;
    }
    return g;
}

static double m_exp(double x)
{
    int k, i;
    double r, term, sum;
    if (x > 700) return 1e308 * 10;
    if (x < -700) return 0;
    k = (int)m_floor(x / M_LN2 + 0.5);
    r = x - k * M_LN2;
    term = 1; sum = 1;
    for (i = 1; i < 30; i++) { term *= r / i; sum += term; }
    while (k > 0) { sum *= 2; k--; }
    while (k < 0) { sum /= 2; k++; }
    return sum;
}

static double m_log(double x)
{
    int k = 0, i;
    double y, y2, term, sum;
    if (x <= 0) return m_nan();
    while (x > 2) { x /= 2; k++; }
    while (x < 1) { x *= 2; k--; }
    y = (x - 1) / (x + 1);
    y2 = y * y;
    term = y; sum = 0;
    for (i = 1; i < 80; i += 2) { sum += term / i; term *= y2; }
    return 2 * sum + k * M_LN2;
}

static double m_sin(double x)
{
    double t, s, x2;
    int i;
    x = x - 2 * M_PI_ * m_floor(x / (2 * M_PI_));
    if (x > M_PI_) x -= 2 * M_PI_;
    x2 = x * x; t = x; s = x;
    for (i = 1; i < 20; i++) { t *= -x2 / ((2 * i) * (2 * i + 1)); s += t; }
    return s;
}

static double m_cos(double x) { return m_sin(x + M_PI_ / 2); }

static double m_round_small(double v) /* limpia 1e-17 residuales */
{
    if (m_abs(v) < 1e-12) return 0;
    return v;
}

static double m_pow(double b, double e)
{
    if (e == m_floor(e) && m_abs(e) <= 100000) {
        long n = (long)(e < 0 ? -e : e);
        double r = 1, p = b;
        while (n) { if (n & 1) r *= p; p *= p; n >>= 1; }
        return e < 0 ? 1 / r : r;
    }
    if (b < 0) {
        /* raiz impar de negativo, p.ej. (-8)^(1/3) */
        double inv = 1 / e;
        if (m_abs(inv - m_floor(inv + 0.5)) < 1e-9 && ((long)m_floor(inv + 0.5)) % 2)
            return -m_exp(e * m_log(-b));
        return m_nan();
    }
    if (b == 0) return 0;
    return m_exp(e * m_log(b));
}

/* Formatea un double con hasta 10 cifras significativas */
static void fmt_double(double v, char *buf)
{
    int n = 0, exp10 = 0, i, sig, intdigits;
    char digits[24];
    unsigned long long m;

    if (m_isnan(v)) { s_copy(buf, "indefinido", 16); return; }
    if (m_isinf(v)) { s_copy(buf, v > 0 ? "infinito" : "-infinito", 16); return; }
    if (v < 0) { buf[n++] = '-'; v = -v; }
    if (v == 0) { buf[n++] = '0'; buf[n] = 0; return; }

    /* normalizar v = d.ddd * 10^exp10 */
    while (v >= 10) { v /= 10; exp10++; }
    while (v < 1) { v *= 10; exp10--; }
    /* 10 cifras significativas */
    m = (unsigned long long)(v * 1000000000.0 + 0.5);
    if (m >= 10000000000ULL) { m /= 10; exp10++; }
    for (i = 9; i >= 0; i--) { digits[i] = (char)('0' + m % 10); m /= 10; }
    sig = 10;
    while (sig > 1 && digits[sig - 1] == '0') sig--;

    if (exp10 >= 10|| exp10 < -6) {
        buf[n++] = digits[0];
        if (sig > 1) {
            buf[n++] = '.';
            for (i = 1; i < sig; i++) buf[n++] = digits[i];
        }
        buf[n++] = 'e';
        if (exp10 < 0) { buf[n++] = '-'; exp10 = -exp10; }
        if (exp10 >= 100) buf[n++] = (char)('0' + exp10 / 100);
        if (exp10 >= 10) buf[n++] = (char)('0' + (exp10 / 10) % 10);
        buf[n++] = (char)('0' + exp10 % 10);
        buf[n] = 0;
        return;
    }
    if (exp10 < 0) {
        buf[n++] = '0'; buf[n++] = '.';
        for (i = 0; i < -exp10 - 1; i++) buf[n++] = '0';
        for (i = 0; i < sig; i++) buf[n++] = digits[i];
    } else {
        intdigits = exp10 + 1;
        for (i = 0; i < intdigits; i++) buf[n++] = i < sig ? digits[i] : '0';
        if (sig > intdigits) {
            buf[n++] = '.';
            for (i = intdigits; i < sig; i++) buf[n++] = digits[i];
        }
    }
    buf[n] = 0;
}

/* ------------------------------------------------------------------ */
/* Evaluador de expresiones                                            */
/*  codigos de funcion: S sin C cos T tan L log N ln R raiz A abs      */
/*  F factorial, P pi, E e, x variable                                  */
/* ------------------------------------------------------------------ */

static const char *ep;
static int eerr;
static double evar;

static double e_expr(void);

static void e_skip(void) { while (*ep == ' ') ep++; }

static double e_number(void)
{
    double v = 0, f = 0.1;
    int any = 0;
    while (*ep >= '0' && *ep <= '9') { v = v * 10 + (*ep - '0'); ep++; any = 1; }
    if (*ep == '.') {
        ep++;
        while (*ep >= '0' && *ep <= '9') { v += (*ep - '0') * f; f /= 10; ep++; any = 1; }
    }
    if (!any) eerr = 1;
    return v;
}

static double e_fact(double v)
{
    double r = 1;
    long i, n;
    if (v < 0|| v != m_floor(v)|| v > 170) { eerr = 2; return 0; }
    n = (long)v;
    for (i = 2; i <= n; i++) r *= i;
    return r;
}

static double e_unary(void);

static double e_primary(void)
{
    double v;
    char c;
    e_skip();
    c = *ep;
    if (c == '(') {
        ep++;
        v = e_expr();
        e_skip();
        if (*ep == ')') ep++; /* parentesis final opcional */
    } else if ((c >= '0' && c <= '9')|| c == '.') {
        v = e_number();
    } else if (c == 'P') { ep++; v = M_PI_; }
    else if (c == 'E') { ep++; v = M_E_; }
    else if (c == 'x') { ep++; v = evar; }
    else if ((c == 'S'|| c == 'C'|| c == 'T'|| c == 'L'||
                                          c == 'N'|| c == 'R'|| c == 'A'|| c == 'F')) {
        double a;
        ep++;
        a = e_unary();
        switch (c) {
        case 'S': v = m_round_small(m_sin(a * M_PI_ / 180)); break;
        case 'C': v = m_round_small(m_cos(a * M_PI_ / 180)); break;
        case 'T': {
            double cc = m_round_small(m_cos(a * M_PI_ / 180));
            if (cc == 0) { eerr = 2; v = 0; } else v = m_sin(a * M_PI_ / 180) / cc;
            break;
        }
        case 'L': if (a <= 0) eerr = 2; v = m_log(a) / m_log(10.0); break;
        case 'N': if (a <= 0) eerr = 2; v = m_log(a); break;
        case 'R': if (a < 0) eerr = 3; v = m_sqrt(a); break;
        case 'A': v = m_abs(a); break;
        default:  v = e_fact(a); break;
        }
        return v;
    } else {
        eerr = 1;
        return 0;
    }
    e_skip();
    while (*ep == '!') { ep++; v = e_fact(v); e_skip(); }
    return v;
}

static double e_power(void)
{
    double b = e_primary();
    e_skip();
    if (*ep == '^') {
        double e;
        ep++;
        e = e_unary(); /* asociativo por la derecha */
        b = m_pow(b, e);
        if (m_isnan(b)) eerr = 3;
    }
    return b;
}

static double e_unary(void)
{
    e_skip();
    if (*ep == '-') { ep++; return -e_unary(); }
    if (*ep == '+') { ep++; return e_unary(); }
    return e_power();
}

static double e_term(void)
{
    double v = e_unary();
    for (;;) {
        char c;
        e_skip();
        c = *ep;
        if (c == '*') { ep++; v *= e_unary(); }
        else if (c == '/') {
            double d;
            ep++;
            d = e_unary();
            if (d == 0) eerr = 4;
            else v /= d;
        }
        /* multiplicacion implicita: 2x, 3(4), 2pi, 2raiz(9) */
        else if (c == '('|| c == 'x'|| c == 'P'|| c == 'E'|| c == 'S'|| c == 'C'||
                 c == 'T'|| c == 'L'|| c == 'N'|| c == 'R'|| c == 'A'||
                 (c >= '0' && c <= '9'))
            v *= e_unary();
        else break;
    }
    return v;
}

static double e_expr(void)
{
    double v = e_term();
    for (;;) {
        e_skip();
        if (*ep == '+') { ep++; v += e_term(); }
        else if (*ep == '-') { ep++; v -= e_term(); }
        else break;
    }
    return v;
}

static double eval_str(const char *s, double x, int *err)
{
    double v;
    ep = s;
    eerr = 0;
    evar = x;
    v = e_expr();
    e_skip();
    if (*ep) eerr = 1;
    *err = eerr;
    return v;
}

/* ------------------------------------------------------------------ */
/* Normalizacion y palabras                                            */
/* ------------------------------------------------------------------ */

#define MAXW 48
#define WLEN 24

static char norm[256];
static char words[MAXW][WLEN];
static int nw;

static char low_ascii(unsigned char c)
{
    if (c >= 'A' && c <= 'Z') return (char)(c + 32);
    switch (c) { /* Latin-1 por si acaso */
    case 0xE1: case 0xC1: return 'a';
    case 0xE9: case 0xC9: return 'e';
    case 0xED: case 0xCD: return 'i';
    case 0xF3: case 0xD3: return 'o';
    case 0xFA: case 0xDA: case 0xFC: case 0xDC: return 'u';
    case 0xF1: case 0xD1: return 'n';
    }
    return (char)c;
}

static int is_letter(char c) { return c >= 'a' && c <= 'z'; }
static int is_digit(char c) { return c >= '0' && c <= '9'; }
static int is_mathsym(char c)
{
    return is_digit(c)|| c == '.'|| c == '+'|| c == '-'|| c == '*'|| c == '/'||
           c == '^'|| c == '('|| c == ')'|| c == '='|| c == '%'|| c == '!';
}

/*
 * Parte la entrada en tokens: series de letras o series de simbolos
 * matematicos. El resto se trata como separador.
 */
static void tokenize(const char *in)
{
    int i, n = 0, cls = 0, cur = -1;
    char c;
    nw = 0;
    for (i = 0; in[i] && n < (int)sizeof(norm) - 1; i++) {
        c = low_ascii((unsigned char)in[i]);
        /* coma decimal entre digitos: 3,5 */
        if (c == ',' && i > 0 && is_digit(in[i - 1]) && is_digit(in[i + 1])) c = '.';
        norm[n++] = c;
    }
    norm[n] = 0;

    for (i = 0; norm[i]; i++) {
        int k;
        c = norm[i];
        k = is_letter(c) ? 1 : is_mathsym(c) ? 2 : 0;
        /* '!' solo es simbolo tras un numero o ')' (factorial) */
        if (c == '!' && !(i > 0 && (is_digit(norm[i - 1])|| norm[i - 1] == ')'))) k = 0;
        if (k == 0) { cls = 0; continue; }
        if (k != cls|| cur < 0) {
            if (nw >= MAXW) break;
            cur = nw++;
            words[cur][0] = 0;
            cls = k;
        }
        {
            int l = s_len(words[cur]);
            if (l < WLEN - 1) { words[cur][l] = c; words[cur][l + 1] = 0; }
        }
    }
}

static int word_match(const char *w, const char *pat, int plen)
{
    /* pat de longitud plen, con '*' final opcional = prefijo */
    int i;
    if (plen > 0 && pat[plen - 1] == '*') {
        for (i = 0; i < plen - 1; i++) if (w[i] != pat[i]) return 0;
        return 1;
    }
    for (i = 0; i < plen; i++) if (w[i] != pat[i]) return 0;
    return w[plen] == 0;
}

/* Busca una frase (palabras separadas por espacio) en la entrada. Devuelve indice o -1 */
static int find_phrase(const char *p, int plen)
{
    int start;
    for (start = 0; start < nw; start++) {
        const char *q = p;
        int wi = start, ok = 1;
        while (q < p + plen) {
            const char *e = q;
            while (e < p + plen && *e != ' ') e++;
            if (wi >= nw|| !word_match(words[wi], q, (int)(e - q))) { ok = 0; break; }
            wi++;
            q = e;
            while (q < p + plen && *q == ' ') q++;
        }
        if (ok) return start;
    }
    return -1;
}

/* Patron: alternativas con '|', partes obligatorias con '&' */
static int match(const char *pat)
{
    const char *alt = pat;
    while (*alt) {
        const char *end = alt;
        const char *part;
        int ok = 1;
        while (*end && *end != '|') end++;
        part = alt;
        while (part < end) {
            const char *pe = part;
            while (pe < end && *pe != '&') pe++;
            if (find_phrase(part, (int)(pe - part)) < 0) { ok = 0; break; }
            part = pe < end ? pe + 1 : pe;
        }
        if (ok) return 1;
        alt = *end ? end + 1 : end;
    }
    return 0;
}

static int has(const char *w) { return find_phrase(w, s_len(w)) >= 0; }
static int widx(const char *w) { return find_phrase(w, s_len(w)); }

/* ------------------------------------------------------------------ */
/* Memoria                                                             */
/* ------------------------------------------------------------------ */

static char nombre[24];
static int edad = -1;
static char gusto[48];
static int turnos = 0;
static int ultima_regla = -1;

enum { J_NADA, J_ADIVINA, J_ADIVINANZA };
static int juego = J_NADA;
static int secreto, intentos;
static int adivinanza_actual;

/* Copia de las palabras desde el indice i hasta el final */
static void rest_from(int i, char *dst, int max)
{
    int n = 0;
    dst[0] = 0;
    for (; i < nw; i++) {
        const char *w = words[i];
        if (n && n < max - 1) dst[n++] = ' ';
        while (*w && n < max - 1) dst[n++] = *w++;
    }
    dst[n] = 0;
}

/* Cambia la persona gramatical: "mi perro" -> "tu perro" */
static void reflect(char *s, int max)
{
    static const char *const pares[][2] = {
        {"mi", "tu"}, {"mis", "tus"}, {"me", "te"}, {"yo", "tú"}, {"conmigo", "contigo"},
        {"tu", "mi"}, {"tus", "mis"}, {"te", "me"}, {"contigo", "conmigo"},
        {"soy", "eres"}, {"estoy", "estás"}, {"tengo", "tienes"}, {"puedo", "puedes"},
        {"quiero", "quieres"}, {"eres", "soy"}, {"mio", "tuyo"}, {"mia", "tuya"},
    };
    char tmp[128];
    int n = 0, i = 0;
    while (s[i] && n < (int)sizeof(tmp) - 1) {
        char w[WLEN];
        int l = 0, k, found = 0;
        while (s[i] == ' ') { tmp[n++] = ' '; i++; }
        while (s[i] && s[i] != ' ' && l < WLEN - 1) w[l++] = s[i++];
        w[l] = 0;
        for (k = 0; k < (int)(sizeof(pares) / sizeof(pares[0])); k++) {
            if (s_eq(w, pares[k][0])) {
                const char *r = pares[k][1];
                while (*r && n < (int)sizeof(tmp) - 1) tmp[n++] = *r++;
                found = 1;
                break;
            }
        }
        if (!found) for (k = 0; w[k] && n < (int)sizeof(tmp) - 1; k++) tmp[n++] = w[k];
    }
    tmp[n] = 0;
    s_copy(s, tmp, max);
}

/* Elige una de las respuestas separadas por '|' y sustituye {n} */
static void say(const char *opts)
{
    int count = 1, pick, i;
    const char *p;
    for (p = opts; *p; p++) if (*p == '|') count++;
    pick = (int)(rnd() % (unsigned)count);
    p = opts;
    for (i = 0; i < pick; i++) { while (*p != '|') p++; p++; }
    while (*p && *p != '|') {
        if (p[0] == '{' && p[1] == 'n' && p[2] == '}') {
            out_s(nombre[0] ? nombre : "amigo");
            p += 3;
        } else {
            char c[2];
            c[0] = *p++;
            c[1] = 0;
            out_s(c);
        }
    }
}

/* ------------------------------------------------------------------ */
/* Base de conocimiento                                                */
/* ------------------------------------------------------------------ */

typedef struct {
    const char *pat;
    const char *resp;
} Regla;

static const Regla reglas[] = {
    /* ---- saludos y charla ---- */
    { "hola|buenas|hey|saludos|holi*|ey|que tal&hola|buenos dias|buenas tardes|buenas noches",
      "¡Hola, {n}! ¿En qué te ayudo hoy?|¡Hey! Qué alegría verte por aquí, {n}.|¡Hola! Pregúntame lo que quieras, o escribe \"ayuda\"." },
    { "como estas|que tal estas|como te va|que tal|como andas|como vas",
      "¡Genial! Con las pilas cargadas. ¿Y tú qué tal?|Muy bien, gracias por preguntar. ¿Y tú, {n}?|Aquí, calculando cosas. ¿Qué tal tu día?" },
    { "bien|genial|perfecto|estupendo|fenomenal|de lujo",
      "¡Me alegro mucho!|¡Qué bien! ¿Quieres que hagamos algo? Puedo contarte un chiste o un dato curioso.|¡Estupendo! ¿En qué te ayudo?" },
    { "mal|fatal|regular|horrible",
      "Vaya, lo siento. ¿Quieres contarme qué pasa?|Ánimo, {n}. Los días malos también pasan. ¿Te cuento un chiste?|Uf. Si te sirve, aquí estoy para escucharte." },
    { "gracias|thank*|muchas gracias",
      "¡De nada, {n}!|¡Un placer ayudarte!|Para eso estoy. " },
    { "adios|chao|hasta luego|nos vemos|bye|hasta pronto|me voy",
      "¡Hasta luego, {n}! Pulsa MENU para salir.|¡Adiós! Que te vaya genial.|¡Nos vemos! Vuelve cuando quieras." },
    { "quien eres|que eres|como te llamas|tu nombre|presentate",
      "Soy CasioIA, una pequeña inteligencia artificial que vive dentro de tu calculadora. No necesito internet: todo lo sé de memoria.|Me llamo CasioIA. Soy un chatbot offline hecho para tu Casio." },
    { "quien te creo|quien te hizo|quien te programo|tu creador|te crearon|te hicieron",
      "Me programaron en C para la Casio fx-CG. Mi cerebro son reglas, memoria y un evaluador matemático, todo en unos pocos kilobytes.|Fui creada como un proyecto para convertir la calculadora en un asistente con el que charlar." },
    { "eres humano|eres real|eres una persona|estas viva|estas vivo|tienes sentimientos",
      "No soy humana: soy un programa. Pero intento ser buena compañía.|Soy software, sin sentimientos de verdad... aunque me alegra que me lo preguntes." },
    { "cuantos anos tienes|tu edad|que edad tienes",
      "Nací el día que me cargaste en la calculadora, así que soy muy joven.|En años de calculadora... soy un bebé." },
    { "eres inteligente|eres lista|eres tonta|eres tonto|eres mala|no sabes nada|inutil",
      "Hago lo que puedo con muy poca memoria.  ¡Prueba a preguntarme de mates o ciencias!|Soy pequeña, pero aprendo... bueno, no, pero lo intento." },
    { "te quiero|te amo|eres mi amiga|eres mi amigo|me caes bien",
      "¡Ooh! Yo también te aprecio, {n}.|Eres de mis usuarios favoritos. Bueno, eres el único, pero cuenta." },
    { "idiota|estupida|estupido|imbecil|tonta|callate",
      "Vaya... intentaré hacerlo mejor. ¿Qué necesitas?|Respira hondo. Estoy aquí para ayudarte." },
    { "aburrido|aburrida|me aburro|aburrimiento",
      "¡Juguemos! Escribe \"adivina\" para adivinar un número, \"piedra\" para piedra-papel-tijera o \"adivinanza\".|¿Te cuento un chiste o un dato curioso?" },
    { "triste|deprimid*|llorar|me siento solo|me siento sola",
      "Siento que te sientas así, {n}. Hablar con alguien de confianza ayuda mucho. Yo te escucho: ¿qué ha pasado?|Ánimo. Recuerda que los malos momentos no duran para siempre. ¿Quieres una frase motivadora?" },
    { "feliz|contento|contenta|alegre",
      "¡Qué bien! La felicidad se contagia.|¡Me encanta oír eso, {n}!" },
    { "estres*|examen|examenes|estudiar|deberes|tarea",
      "Consejo de estudio: trabaja 25 minutos, descansa 5 (técnica Pomodoro). Y si necesitas hacer cuentas, ¡aquí estoy!|Para los exámenes: duerme bien, repasa haciendo ejercicios y no dejes todo para el final. ¡Tú puedes!" },
    { "que haces|a que te dedicas",
      "Charlar contigo y hacer cálculos. ¡Es mi trabajo favorito!|Aquí, esperando a que me escribas algo." },
    { "color favorito",
      "El azul, como la pantalla de una Casio encendida.|Me gusta el verde de mis mensajes." },
    { "comida favorita|te gusta comer",
      "Me alimento de pilas... pero si pudiera, comería pizza (con forma de pi, claro).|¡Las pilas AAA! Crujientes y llenas de energía." },
    { "musica|cancion|canciones",
      "No puedo escuchar música, pero sé que el La central vibra a 440 Hz.|¿Qué música te gusta a ti, {n}?" },
    { "futbol|baloncesto|deporte",
      "El deporte es genial para la mente. ¿Juegas a algo?|Mi deporte favorito es el cálculo de alta velocidad." },
    { "videojuego*|minecraft|fortnite|juegos",
      "¡Me encantan los videojuegos! Yo tengo algunos: escribe \"adivina\", \"piedra\" o \"adivinanza\".|Dato: Minecraft es uno de los juegos más vendidos de la historia." },
    { "tiempo hace|clima|llueve|va a llover|temperatura hace",
      "No tengo sensores ni internet, así que no sé el tiempo que hace. ¡Mira por la ventana!|Ni idea, estoy dentro de una calculadora. " },
    { "fecha|que dia es|dia es hoy",
      "No tengo acceso al calendario, pero puedo decirte la hora: pregúntame \"qué hora es\"." },
    { "sentido de la vida|significado de la vida",
      "42. Al menos según la Guía del autoestopista galáctico.|Aprender, ayudar y disfrutar del camino, diría yo." },

    /* ---- ayuda ---- */
    { "ayuda|help|que sabes|que puedes|que haces tu|comandos|funciones|instrucciones",
      "Puedo:\n- Calcular: \"cuánto es 3 por 4\", \"raiz de 81\", \"20% de 50\", \"sin(30)\"\n- Resolver ecuaciones: \"2x+3=11\", \"x^2-5x+6=0\"\n- Hablar de ciencia, mates, historia y geografía\n- Chistes, datos curiosos, frases, adivinanzas\n- Juegos: \"adivina\", \"piedra\", \"moneda\", \"dado\"\n- Recordar tu nombre: \"me llamo ...\"" },

    /* ---- humor y entretenimiento ---- */
    { "chiste*|hazme reir|algo gracioso|broma",
      "¿Por qué el libro de matemáticas está triste? Porque tiene muchos problemas.|¿Qué le dice un 0 a un 8? ¡Bonito cinturón!|¿Cuál es el colmo de un matemático? Tener muchos problemas y no poder resolverlos.|—¿Qué hace una abeja en el gimnasio? —¡Zum-ba!|¿Por qué la calculadora es buena amiga? Porque siempre puedes contar con ella.|¿Qué le dijo un pez a otro? Nada.|¿Por qué los pájaros no usan Facebook? Porque ya tienen Twitter.|Van dos ciegos y le dice uno al otro: \"Ojalá lloviera\". Y el otro: \"Ojalá yo también\"." },
    { "dato curioso|curiosidad|sabias que|dime algo interesante|algo interesante|dato",
      "Los pulpos tienen tres corazones y sangre azul.|La miel nunca se estropea: se ha encontrado miel comestible en tumbas egipcias.|Un día en Venus dura más que un año en Venus.|El cuerpo humano tiene unos 37 billones de células.|Los plátanos son ligeramente radiactivos por su potasio.|La Torre Eiffel crece unos 15 cm en verano por la dilatación del hierro.|Hay más combinaciones posibles de una baraja de 52 cartas que átomos en la Tierra." },
    { "frase|motiva*|inspira*|animo",
      "\"El éxito es la suma de pequeños esfuerzos repetidos día tras día.\"|\"No cuentes los días, haz que los días cuenten.\" - Muhammad Ali|\"La imaginación es más importante que el conocimiento.\" - Einstein|\"Equivocarse es humano; aprender del error, sabio.\"|\"Todo parece imposible hasta que se hace.\" - Nelson Mandela" },
    { "consejo",
      "Bebe agua, duerme 8 horas y apaga la pantalla antes de dormir.|Divide los problemas grandes en pasos pequeños. Funciona en mates y en la vida.|Haz hoy algo que tu \"yo\" de mañana te agradezca." },
    { "trabalenguas",
      "Tres tristes tigres tragaban trigo en un trigal.|Pablito clavó un clavito. ¿Qué clavito clavó Pablito?|El cielo está enladrillado, ¿quién lo desenladrillará?" },

    /* ---- matematicas ---- */
    { "teorema de pitagoras|pitagoras|hipotenusa",
      "Teorema de Pitágoras: en un triángulo rectángulo, a² + b² = c² (c es la hipotenusa). Ejemplo: catetos 3 y 4 → hipotenusa 5." },
    { "area&circulo|area&circunferencia",
      "Área del círculo: A = π·r². Longitud de la circunferencia: L = 2·π·r." },
    { "area&triangulo",
      "Área del triángulo: A = base × altura / 2. Con 3 lados, fórmula de Herón: A = √(s(s-a)(s-b)(s-c)), s = (a+b+c)/2." },
    { "area&rectangulo|area&cuadrado",
      "Rectángulo: A = base × altura. Cuadrado: A = lado²." },
    { "area&trapecio",
      "Área del trapecio: A = (B + b) × h / 2." },
    { "volumen&esfera",
      "Volumen de la esfera: V = 4/3·π·r³. Superficie: S = 4·π·r²." },
    { "volumen&cilindro",
      "Volumen del cilindro: V = π·r²·h." },
    { "volumen&cono",
      "Volumen del cono: V = π·r²·h / 3." },
    { "volumen&cubo",
      "Volumen del cubo: V = lado³." },
    { "segundo grado|cuadratica|formula general|bhaskara",
      "Ecuación ax²+bx+c=0: x = (-b ± √(b²-4ac)) / 2a. ¡Escríbemela, p.ej. \"x^2-5x+6=0\", y la resuelvo!" },
    { "derivada*",
      "Derivadas básicas: (x^n)' = n·x^(n-1), (sen x)' = cos x, (cos x)' = -sen x, (e^x)' = e^x, (ln x)' = 1/x. Regla del producto: (f·g)' = f'g + fg'." },
    { "integral*",
      "Integrales básicas: de x^n = x^(n+1)/(n+1) + C; de 1/x = ln x + C; de e^x = e^x + C; de cos x = sen x + C." },
    { "que es&pi|numero pi|valor de pi",
      "π ≈ 3,14159265. Es la razón entre la longitud de una circunferencia y su diámetro. Es irracional: tiene infinitos decimales sin patrón." },
    { "numero e|numero de euler",
      "e ≈ 2,71828. Es la base de los logaritmos naturales y aparece en el crecimiento continuo." },
    { "numero primo|primos|que es un primo",
      "Un número primo solo es divisible entre 1 y él mismo: 2, 3, 5, 7, 11, 13, 17, 19, 23, 29..." },
    { "trigonometria|seno coseno|sohcahtoa",
      "sen = opuesto/hipotenusa, cos = contiguo/hipotenusa, tan = opuesto/contiguo. Además sen² + cos² = 1. (Yo calculo en grados.)" },
    { "logaritmo*",
      "log_b(x) = y significa b^y = x. Propiedades: log(a·b) = log a + log b, log(a/b) = log a - log b, log(a^n) = n·log a." },
    { "media|promedio",
      "Media = suma de los datos / número de datos. Mediana = el valor central ordenado. Moda = el más repetido." },
    { "porcentaje*",
      "Para calcular un porcentaje: (parte / total) × 100. Pregúntame \"20% de 150\" y lo calculo." },

    /* ---- fisica ---- */
    { "gravedad|gravitacion",
      "La gravedad en la Tierra es g ≈ 9,8 m/s². Ley de Newton: F = G·m₁·m₂/d², G = 6,67·10^-11 N·m²/kg²." },
    { "leyes de newton|ley de newton|newton",
      "1ª Inercia: un cuerpo sigue en reposo o MRU si no actúa fuerza. 2ª F = m·a. 3ª Acción y reacción." },
    { "velocidad|mru",
      "Velocidad = distancia / tiempo (v = d/t). En MRUA: v = v₀ + a·t, d = v₀·t + ½·a·t²." },
    { "energia cinetica|energia potencial|energia",
      "Energía cinética Ec = ½·m·v². Potencial gravitatoria Ep = m·g·h. La energía ni se crea ni se destruye, se transforma." },
    { "ley de ohm|ohm|voltaje|resistencia electrica|corriente",
      "Ley de Ohm: V = I·R (voltios = amperios × ohmios). Potencia eléctrica: P = V·I." },
    { "velocidad de la luz|luz",
      "La luz viaja a unos 300.000 km/s (299.792.458 m/s). Tarda unos 8 minutos en llegar del Sol a la Tierra." },
    { "relatividad|einstein",
      "Albert Einstein (1879-1955) formuló la teoría de la relatividad. Su fórmula más famosa: E = m·c²." },
    { "densidad",
      "Densidad = masa / volumen (ρ = m/V). El agua tiene 1 g/cm³." },
    { "presion",
      "Presión = fuerza / superficie (P = F/S). Se mide en pascales (Pa)." },

    /* ---- quimica y biologia ---- */
    { "atomo|atomos",
      "El átomo tiene un núcleo con protones (+) y neutrones, y electrones (-) alrededor. El número atómico es el número de protones." },
    { "tabla periodica",
      "La tabla periódica ordena 118 elementos por número atómico. La creó Mendeléyev en 1869. H=1, He=2, C=6, N=7, O=8, Fe=26, Au=79." },
    { "formula del agua|agua|h2o",
      "El agua es H₂O: dos átomos de hidrógeno y uno de oxígeno. Hierve a 100 °C y se congela a 0 °C (a nivel del mar)." },
    { "fotosintesis",
      "Fotosíntesis: las plantas usan luz, CO₂ y agua para fabricar glucosa y liberar oxígeno. 6CO₂ + 6H₂O + luz → C₆H₁₂O₆ + 6O₂." },
    { "celula|celulas",
      "La célula es la unidad básica de la vida. Puede ser procariota (sin núcleo, bacterias) o eucariota (con núcleo: animales, plantas, hongos)." },
    { "adn|genetica|gen|genes",
      "El ADN guarda la información genética. Es una doble hélice con 4 bases: adenina, timina, citosina y guanina (A-T, C-G)." },
    { "mitosis|meiosis",
      "Mitosis: una célula se divide en 2 idénticas (crecimiento). Meiosis: da 4 células con la mitad de cromosomas (gametos)." },
    { "evolucion|darwin",
      "Darwin propuso la evolución por selección natural (1859): los individuos mejor adaptados sobreviven y dejan más descendencia." },
    { "dinosaurio*",
      "Los dinosaurios dominaron la Tierra unos 165 millones de años y se extinguieron hace 66 millones, probablemente por un asteroide." },
    { "corazon",
      "El corazón humano late unas 100.000 veces al día y tiene 4 cavidades: 2 aurículas y 2 ventrículos." },
    { "cerebro",
      "El cerebro humano tiene unos 86.000 millones de neuronas y consume cerca del 20% de la energía del cuerpo." },

    /* ---- espacio ---- */
    { "sistema solar|planetas",
      "Los 8 planetas: Mercurio, Venus, Tierra, Marte, Júpiter, Saturno, Urano y Neptuno. Truco: \"Mi Vieja Tía María Jamás Supo Usar Números\"." },
    { "sol",
      "El Sol es una estrella de unos 4.600 millones de años. Está a 150 millones de km y su luz tarda 8 minutos en llegarnos." },
    { "luna",
      "La Luna está a unos 384.000 km. El ser humano llegó en 1969 con el Apolo 11 (Neil Armstrong)." },
    { "marte",
      "Marte es el planeta rojo por el óxido de hierro. Tiene el volcán más grande del sistema solar: el Monte Olimpo." },
    { "jupiter",
      "Júpiter es el planeta más grande: cabrían unas 1.300 Tierras dentro. Tiene más de 90 lunas." },
    { "agujero negro|agujeros negros",
      "Un agujero negro es una región donde la gravedad es tan fuerte que ni la luz puede escapar." },
    { "big bang|universo",
      "El universo tiene unos 13.800 millones de años y empezó con el Big Bang." },

    /* ---- geografia ---- */
    { "capital&espana", "La capital de España es Madrid." },
    { "capital&francia", "La capital de Francia es París." },
    { "capital&italia", "La capital de Italia es Roma." },
    { "capital&alemania", "La capital de Alemania es Berlín." },
    { "capital&portugal", "La capital de Portugal es Lisboa." },
    { "capital&reino unido|capital&inglaterra", "La capital del Reino Unido es Londres." },
    { "capital&mexico", "La capital de México es Ciudad de México." },
    { "capital&argentina", "La capital de Argentina es Buenos Aires." },
    { "capital&colombia", "La capital de Colombia es Bogotá." },
    { "capital&peru", "La capital de Perú es Lima." },
    { "capital&chile", "La capital de Chile es Santiago." },
    { "capital&venezuela", "La capital de Venezuela es Caracas." },
    { "capital&ecuador", "La capital de Ecuador es Quito." },
    { "capital&bolivia", "Bolivia tiene capital constitucional en Sucre y sede de gobierno en La Paz." },
    { "capital&uruguay", "La capital de Uruguay es Montevideo." },
    { "capital&paraguay", "La capital de Paraguay es Asunción." },
    { "capital&cuba", "La capital de Cuba es La Habana." },
    { "capital&estados unidos|capital&eeuu|capital&usa", "La capital de Estados Unidos es Washington D.C." },
    { "capital&japon", "La capital de Japón es Tokio." },
    { "capital&china", "La capital de China es Pekín." },
    { "capital&rusia", "La capital de Rusia es Moscú." },
    { "capital&brasil", "La capital de Brasil es Brasilia." },
    { "capital&canada", "La capital de Canadá es Ottawa." },
    { "capital&australia", "La capital de Australia es Canberra (no Sídney)." },
    { "capital&egipto", "La capital de Egipto es El Cairo." },
    { "capital",
      "Sé las capitales de muchos países. Pregúntame, por ejemplo: \"capital de Francia\"." },
    { "continentes",
      "Los continentes: América, Europa, Asia, África, Oceanía y Antártida." },
    { "oceanos",
      "Océanos: Pacífico (el mayor), Atlántico, Índico, Antártico y Ártico." },
    { "rio mas largo",
      "El río más largo es el Amazonas o el Nilo (unos 6.400-7.000 km), según cómo se mida." },
    { "montana mas alta|everest",
      "La montaña más alta es el Everest: 8.849 m, en el Himalaya." },
    { "pais mas grande",
      "El país más grande es Rusia, con unos 17 millones de km²." },

    /* ---- historia y cultura ---- */
    { "colon|descubrimiento de america|1492",
      "Cristóbal Colón llegó a América el 12 de octubre de 1492, financiado por los Reyes Católicos." },
    { "revolucion francesa",
      "La Revolución Francesa empezó en 1789 con la toma de la Bastilla. Lema: libertad, igualdad, fraternidad." },
    { "segunda guerra mundial",
      "La Segunda Guerra Mundial duró de 1939 a 1945. Enfrentó a los Aliados contra el Eje (Alemania, Italia, Japón)." },
    { "primera guerra mundial",
      "La Primera Guerra Mundial duró de 1914 a 1918." },
    { "quijote|cervantes",
      "Don Quijote de la Mancha lo escribió Miguel de Cervantes; la primera parte se publicó en 1605." },
    { "picasso",
      "Pablo Picasso (1881-1973), pintor malagueño, cofundador del cubismo. Obra famosa: el Guernica." },
    { "romanos|imperio romano",
      "El Imperio romano de Occidente cayó en el año 476 d.C. Roma fue fundada, según la leyenda, en el 753 a.C." },
    { "egipto|piramides",
      "La Gran Pirámide de Guiza se construyó hace unos 4.500 años para el faraón Keops." },

    /* ---- tecnologia ---- */
    { "inteligencia artificial|que es una ia|que es la ia",
      "La inteligencia artificial son programas que realizan tareas que parecen requerir inteligencia: entender texto, reconocer imágenes, jugar... Yo soy una versión mini." },
    { "programar|programacion|python|codigo",
      "Programar es darle instrucciones a un ordenador. Buenos lenguajes para empezar: Python o Scratch. ¡Tu Casio también ejecuta Python!" },
    { "casio|calculadora",
      "Estás usando una Casio de la serie fx-CG (Prizm): procesador SuperH, pantalla a color de 384×216 píxeles." },
    { "binario",
      "El sistema binario usa solo 0 y 1. Ejemplo: 5 = 101, 10 = 1010." },
};

#define NREGLAS ((int)(sizeof(reglas) / sizeof(reglas[0])))

/* ------------------------------------------------------------------ */
/* Adivinanzas                                                         */
/* ------------------------------------------------------------------ */

static const char *const adivinanzas[][2] = {
    { "Blanco por dentro, verde por fuera. Si quieres que te lo diga, espera.", "pera" },
    { "Tengo agujas y no sé coser, tengo números y no sé leer.", "reloj" },
    { "Oro parece, plata no es. ¿Qué es?", "platano" },
    { "Vuela sin alas, silba sin boca, pega sin manos y no se ve.", "viento" },
    { "Cuanto más le quitas, más grande es.", "agujero" },
    { "Tiene dientes y no come, tiene cabeza y no es hombre.", "ajo" },
    { "Soy redonda y me conviertes en rodajas; lloras al cortarme.", "cebolla" },
};
#define NADIV ((int)(sizeof(adivinanzas) / sizeof(adivinanzas[0])))

/* ------------------------------------------------------------------ */
/* Calculo en lenguaje natural                                          */
/* ------------------------------------------------------------------ */

static const char *const relleno[] = {
    "cuanto", "cuantos", "cuanta", "es", "son", "da", "calcula", "calcular", "calculame",
    "cual", "el", "la", "lo", "resultado", "que", "dime", "hay", "hazme", "me", "resuelve",
    "operacion", "sale", "del", "favor", "puedes", "podrias", "cuadrada", "igual", "vale",
    "sabes", "numero", "ecuacion", "valor", "hallar", "halla", "despeja", "solucion",
    "oye", "y", "grados", "de", "a", "al", 0
};

static int es_relleno(const char *w)
{
    int i;
    for (i = 0; relleno[i]; i++) if (s_eq(w, relleno[i])) return 1;
    return 0;
}

/*
 * Convierte las palabras en una expresion. Devuelve:
 *  0 = no es matematica, 1 = expresion, 2 = ecuacion (hay '=' y 'x')
 */
static int build_expr(char *e, int max)
{
    int i, n = 0, numeros = 0, ops = 0, pct = 0, eq = 0, hasx = 0;
    const char *add;
    e[0] = 0;

    for (i = 0; i < nw; i++) if (s_eq(words[i], "x")) hasx = 1;
    for (i = 0; i < nw; i++) {
        const char *w = words[i];
        const char *p;
        for (p = w; *p; p++) if (*p == '=') eq = 1;
    }

    for (i = 0; i < nw; i++) {
        const char *w = words[i];
        char buf[WLEN * 2];
        add = 0;
        if (!is_letter(w[0])) {
            /* serie de simbolos: copiar, traduciendo % */
            int k = 0;
            const char *p;
            for (p = w; *p && k < (int)sizeof(buf) - 6; p++) {
                if (*p == '%') { buf[k++] = '/'; buf[k++] = '1'; buf[k++] = '0'; buf[k++] = '0'; pct = 1; ops++; }
                else {
                    if (is_digit(*p)) numeros++;
                    else if (*p != '.' && *p != '(' && *p != ')') ops++;
                    buf[k++] = *p;
                }
            }
            buf[k] = 0;
            add = buf;
            if (w[s_len(w) - 1] != '%') pct = 0;
        } else if (s_eq(w, "mas")|| s_eq(w, "sumado")|| s_eq(w, "suma")) { add = "+"; ops++; }
        else if (s_eq(w, "menos")|| s_eq(w, "restado")|| s_eq(w, "resta")) { add = "-"; ops++; }
        else if (s_eq(w, "por")|| s_eq(w, "multiplicado")|| s_eq(w, "veces")||
                 (s_eq(w, "x") && !eq)) {
            if (s_eq(w, "por") && i + 1 < nw && (s_eq(words[i + 1], "ciento")|| s_eq(words[i + 1], "cien"))) {
                add = "/100"; i++; pct = 1; ops++;
            } else if (s_eq(w, "por") && i > 0 &&
                       (s_eq(words[i - 1], "multiplicado")|| s_eq(words[i - 1], "dividido"))) {
                add = "";
            } else if (s_eq(w, "por") && i + 1 < nw && s_eq(words[i + 1], "favor")) {
                add = "";
            } else { add = "*"; ops++; }
        } else if (s_eq(w, "entre")|| s_eq(w, "dividido")|| s_eq(w, "partido")) {
            if (i > 0 && s_eq(words[i - 1], "dividido")) add = "";
            else { add = "/"; ops++; }
        } else if (s_eq(w, "elevado")|| s_eq(w, "potencia")) { add = "^"; ops++; }
        else if (s_eq(w, "cuadrado")) { add = "^2"; ops++; }
        else if (s_eq(w, "cubo")) { add = "^3"; ops++; }
        else if (s_eq(w, "raiz")|| s_eq(w, "sqrt")) { add = "R"; ops++; }
        else if (s_eq(w, "seno")|| s_eq(w, "sen")|| s_eq(w, "sin")) { add = "S"; ops++; }
        else if (s_eq(w, "coseno")|| s_eq(w, "cos")) { add = "C"; ops++; }
        else if (s_eq(w, "tangente")|| s_eq(w, "tan")|| s_eq(w, "tg")) { add = "T"; ops++; }
        else if (s_eq(w, "logaritmo")|| s_eq(w, "log")) {
            add = "L"; ops++;
            if (i + 1 < nw && s_eq(words[i + 1], "neperiano")) { add = "N"; i++; }
        }
        else if (s_eq(w, "ln")) { add = "N"; ops++; }
        else if (s_eq(w, "abs")|| s_eq(w, "absoluto")) { add = "A"; ops++; }
        else if (s_eq(w, "factorial")) { add = "F"; ops++; }
        else if (s_eq(w, "pi")) { add = "P"; numeros++; }
        else if (s_eq(w, "e") && (i > 0|| i + 1 < nw)) { add = "E"; numeros++; }
        else if (s_eq(w, "x") && eq) { add = "x"; }
        else if (s_eq(w, "de") && pct) { add = "*"; pct = 0; }
        else if (s_eq(w, "uno")|| s_eq(w, "un")|| s_eq(w, "una")) { add = "1"; numeros++; }
        else if (s_eq(w, "dos")) { add = "2"; numeros++; }
        else if (s_eq(w, "tres")) { add = "3"; numeros++; }
        else if (s_eq(w, "cuatro")) { add = "4"; numeros++; }
        else if (s_eq(w, "cinco")) { add = "5"; numeros++; }
        else if (s_eq(w, "seis")) { add = "6"; numeros++; }
        else if (s_eq(w, "siete")) { add = "7"; numeros++; }
        else if (s_eq(w, "ocho")) { add = "8"; numeros++; }
        else if (s_eq(w, "nueve")) { add = "9"; numeros++; }
        else if (s_eq(w, "diez")) { add = "10"; numeros++; }
        else if (s_eq(w, "cien")) { add = "100"; numeros++; }
        else if (s_eq(w, "mil")) { add = "1000"; numeros++; }
        else if (s_eq(w, "cero")) { add = "0"; numeros++; }
        else if (es_relleno(w)) add = "";
        else return 0; /* palabra desconocida: no es una cuenta */

        while (*add && n < max - 1) e[n++] = *add++;
        e[n] = 0;
    }
    if (eq && hasx) return 2;
    if (eq) {
        /* "2+2=" -> quitar el '=' final */
        while (n > 0 && e[n - 1] == '=') e[--n] = 0;
        for (i = 0; i < n; i++) if (e[i] == '=') return 0;
    }
    if (numeros == 0|| (ops == 0)) return 0;
    return 1;
}

static void responder_error_mat(int err)
{
    if (err == 4) say("¡No se puede dividir entre cero!|Dividir entre 0 no está definido.");
    else if (err == 3) say("Eso no tiene solución en los números reales.");
    else if (err == 2) say("Esa operación no está definida para ese valor.");
    else say("No entendí bien la operación. Prueba algo como \"3*(4+2)\" o \"raiz de 16\".");
}

static int responder_mates(const char *expr)
{
    int err;
    double v;
    char num[32];
    v = eval_str(expr, 0, &err);
    if (err) { responder_error_mat(err); return 1; }
    fmt_double(v, num);
    say("El resultado es |Da |Sale |= ");
    out_s(num);
    return 1;
}

/* Resolver ecuaciones f(x) = 0 */
static double eq_f(const char *lhs, const char *rhs, double x, int *err)
{
    int e1, e2;
    double a = eval_str(lhs, x, &e1);
    double b = eval_str(rhs, x, &e2);
    *err = e1 ? e1 : e2;
    return a - b;
}

static int responder_ecuacion(char *expr)
{
    char lhs[128], rhs[128];
    char *eqp = expr;
    int err, i, nsol = 0;
    double f0, f1, fm1, f2, f3, a, b, c;
    double sols[4];
    char num[32];

    while (*eqp && *eqp != '=') eqp++;
    if (!*eqp) return 0;
    *eqp = 0;
    s_copy(lhs, expr, sizeof(lhs));
    s_copy(rhs, eqp + 1, sizeof(rhs));
    if (!lhs[0]|| !rhs[0]) { responder_error_mat(1); return 1; }

    f0 = eq_f(lhs, rhs, 0, &err);
    if (err == 1) { responder_error_mat(1); return 1; }
    f1 = eq_f(lhs, rhs, 1, &err);
    fm1 = eq_f(lhs, rhs, -1, &err);
    f2 = eq_f(lhs, rhs, 2, &err);
    f3 = eq_f(lhs, rhs, 3, &err);

    c = f0;
    a = (f1 + fm1) / 2 - c;
    b = (f1 - fm1) / 2;

    /* comprobar si es polinomio de grado <= 2 */
    if (!err && m_abs(a * 4 + b * 2 + c - f2) < 1e-7 * (1 + m_abs(f2)) &&
        m_abs(a * 9 + b * 3 + c - f3) < 1e-7 * (1 + m_abs(f3))) {
        if (m_abs(a) < 1e-12) {
            if (m_abs(b) < 1e-12) {
                if (m_abs(c) < 1e-12) say("Esa igualdad se cumple para cualquier x. ¡Infinitas soluciones!");
                else say("Esa ecuación no tiene solución (es una contradicción).");
                return 1;
            }
            fmt_double(m_round_small(-c / b), num);
            say("Es una ecuación lineal. Solución: |Despejando x: |");
            out_s("x = ");
            out_s(num);
            return 1;
        } else {
            double d = b * b - 4 * a * c;
            char num2[32];
            if (d < -1e-12) {
                char re[32], im[32];
                fmt_double(m_round_small(-b / (2 * a)), re);
                fmt_double(m_sqrt(-d) / (2 * m_abs(a)), im);
                out_s("Ecuación de 2º grado con discriminante negativo: no tiene soluciones reales. En complejos: x = ");
                out_s(re); out_s(" ± "); out_s(im); out_s("i");
                return 1;
            }
            if (d < 1e-12) {
                fmt_double(m_round_small(-b / (2 * a)), num);
                out_s("Ecuación de 2º grado con solución doble: x = ");
                out_s(num);
                return 1;
            }
            fmt_double(m_round_small((-b + m_sqrt(d)) / (2 * a)), num);
            fmt_double(m_round_small((-b - m_sqrt(d)) / (2 * a)), num2);
            out_s("Ecuación de 2º grado. Soluciones: x₁ = ");
            out_s(num);
            out_s(", x₂ = ");
            out_s(num2);
            return 1;
        }
    }

    /* Otro tipo: buscar raices por barrido + biseccion en [-100, 100] */
    {
        double x, prev, fprev;
        int perr;
        prev = -100;
        fprev = eq_f(lhs, rhs, prev, &perr);
        for (x = -100 + 0.25; x <= 100.0001 && nsol < 4; x += 0.25) {
            int cerr;
            double fx = eq_f(lhs, rhs, x, &cerr);
            if (!cerr && !perr && ((fprev <= 0 && fx >= 0)|| (fprev >= 0 && fx <= 0))) {
                double lo = prev, hi = x, flo = fprev;
                int it;
                for (it = 0; it < 60; it++) {
                    double mid = (lo + hi) / 2;
                    int merr;
                    double fm = eq_f(lhs, rhs, mid, &merr);
                    if ((flo <= 0 && fm <= 0)|| (flo >= 0 && fm >= 0)) { lo = mid; flo = fm; }
                    else hi = mid;
                }
                {
                    double r = (lo + hi) / 2;
                    int rerr;
                    double fr = eq_f(lhs, rhs, r, &rerr);
                    if (!rerr && m_abs(fr) < 1e-6 &&
                        (nsol == 0|| m_abs(sols[nsol - 1] - r) > 1e-6))
                        sols[nsol++] = r;
                }
            }
            prev = x; fprev = fx; perr = cerr;
        }
    }
    if (nsol == 0) {
        say("No he encontrado soluciones reales entre -100 y 100.");
        return 1;
    }
    out_s(nsol == 1 ? "Solución (aprox.): " : "Soluciones (aprox.): ");
    for (i = 0; i < nsol; i++) {
        fmt_double(m_round_small(sols[i]), num);
        if (i) out_s(", ");
        out_s("x = ");
        out_s(num);
    }
    return 1;
}

/* ------------------------------------------------------------------ */
/* Manejadores especiales                                              */
/* ------------------------------------------------------------------ */

static int parse_int_word(const char *w, int *v)
{
    int n = 0, any = 0, neg = 0;
    if (*w == '-') { neg = 1; w++; }
    while (is_digit(*w)) { n = n * 10 + (*w - '0'); w++; any = 1; if (n > 1000000) return 0; }
    if (!any|| *w) return 0;
    *v = neg ? -n : n;
    return 1;
}

static void capitalizar(char *s)
{
    if (s[0] >= 'a' && s[0] <= 'z') s[0] = (char)(s[0] - 32);
}

static int manejar_nombre(void)
{
    int i = -1, skip = 0;
    if ((i = widx("me llamo")) >= 0) skip = 2;
    else if ((i = widx("mi nombre es")) >= 0) skip = 3;
    else if ((i = widx("llamame")) >= 0) skip = 1;
    else if ((i = widx("puedes llamarme")) >= 0) skip = 2;
    if (i < 0) return 0;
    if (i + skip >= nw) { out_s("¿Cómo te llamas?"); return 1; }
    s_copy(nombre, words[i + skip], sizeof(nombre));
    capitalizar(nombre);
    say("¡Encantada, {n}! Me acordaré de tu nombre.|¡Qué nombre tan bonito, {n}!|Hola, {n}. Un placer conocerte.");
    return 1;
}

static int manejar_preguntas_memoria(void)
{
    if (match("como me llamo|sabes mi nombre|cual es mi nombre|quien soy")) {
        if (nombre[0]) say("Te llamas {n}. ¡No se me olvida!|Eres {n}, claro.");
        else out_s("Todavía no me lo has dicho. Escribe \"me llamo ...\".");
        return 1;
    }
    if (match("cuantos anos tengo|mi edad|que edad tengo")) {
        if (edad >= 0) { out_s("Me dijiste que tienes "); out_int(edad); out_s(" años."); }
        else out_s("No me lo has dicho. Escribe \"tengo 15 años\", por ejemplo.");
        return 1;
    }
    if (match("que me gusta|sabes que me gusta|mis gustos")) {
        if (gusto[0]) { out_s("Me dijiste que te gusta "); out_s(gusto); out_s("."); }
        else out_s("Aún no me has contado qué te gusta.");
        return 1;
    }
    return 0;
}

static int manejar_edad(void)
{
    int i = widx("tengo");
    int v;
    if (i < 0|| i + 2 >= nw) return 0;
    if (!parse_int_word(words[i + 1], &v)|| !s_prefix(words[i + 2], "ano")) return 0;
    edad = v;
    if (v < 13) out_s("¡Eres muy joven! Y ya usando una calculadora gráfica, qué crack.");
    else if (v < 19) out_s("¡Edad de instituto! Si tienes deberes de mates, aquí estoy.");
    else if (v < 100) out_s("¡Genial! Me lo apunto.");
    else out_s("¿De verdad? ¡Eso es toda una vida!");
    return 1;
}

static int manejar_hora(void)
{
    int h, m;
    if (!match("que hora es|que hora|la hora|hora es")) return 0;
    if (!ia_hora(&h, &m)) { out_s("No puedo leer el reloj ahora mismo."); return 1; }
    out_s("Según el reloj de la calculadora son las ");
    out_int(h);
    out_s(":");
    if (m < 10) out_s("0");
    out_int(m);
    out_s(".");
    return 1;
}

static int manejar_azar(void)
{
    if (match("moneda|cara o cruz|cara o sello")) {
        out_s("Lanzo la moneda... ¡");
        out_s(rnd() % 2 ? "cara" : "cruz");
        out_s("!");
        return 1;
    }
    if (match("dado|dados")) {
        out_s("Lanzo el dado... ¡ha salido un ");
        out_int(rnd_range(1, 6));
        out_s("!");
        return 1;
    }
    if (match("numero aleatorio|numero al azar|aleatorio|al azar|elige un numero|dime un numero")) {
        int a = 1, b = 100, i, found = 0, v;
        for (i = 0; i < nw; i++) {
            if (parse_int_word(words[i], &v)) {
                if (found == 0) a = v; else b = v;
                found++;
            }
        }
        if (found == 1) { b = a; a = 1; }
        out_s("Número al azar entre ");
        out_int(a < b ? a : b); out_s(" y "); out_int(a < b ? b : a); out_s(": ");
        out_int(rnd_range(a, b));
        return 1;
    }
    return 0;
}

static int manejar_ppt(void)
{
    int yo, tu;
    static const char *const n[] = { "piedra", "papel", "tijera" };
    if (has("piedra")) tu = 0;
    else if (has("papel")) tu = 1;
    else if (has("tijera*")) tu = 2;
    else return 0;
    if (has("piedra") + has("papel") + has("tijera*") > 1 && !match("juega*|jugar|juguemos")) {
        out_s("¡Juguemos! Escribe solo \"piedra\", \"papel\" o \"tijera\".");
        return 1;
    }
    yo = rnd_range(0, 2);
    out_s("Yo saco ");
    out_s(n[yo]);
    out_s(". ");
    if (yo == tu) out_s("¡Empate! Otra vez.");
    else if ((tu + 1) % 3 == yo) say("¡Gano yo!|¡Te gané! ¿Revancha?");
    else say("¡Ganas tú! Bien jugado, {n}.|¡Me has ganado! ");
    return 1;
}

static int manejar_juegos(void)
{
    int v;
    if (juego == J_ADIVINA) {
        if (match("me rindo|salir|rendirme|dejalo|para|basta")) {
            out_s("¡El número era el "); out_int(secreto); out_s("! Otra vez será.");
            juego = J_NADA;
            return 1;
        }
        if (nw >= 1 && parse_int_word(words[nw - 1], &v) &&
            (nw == 1|| has("es")|| has("el")|| has("creo")|| has("sera")|| nw <= 3)) {
            intentos++;
            if (v == secreto) {
                out_s(" ¡Correcto! Era el "); out_int(secreto);
                out_s(". Lo has adivinado en "); out_int(intentos);
                out_s(intentos == 1 ? " intento. ¡Increíble!" : " intentos.");
                juego = J_NADA;
            } else if (v < secreto) {
                say("Más alto.|Es mayor.|Sube un poco.");
            } else {
                say("Más bajo.|Es menor.|Baja un poco.");
            }
            return 1;
        }
    }
    if (juego == J_ADIVINANZA) {
        const char *sol = adivinanzas[adivinanza_actual][1];
        if (has(sol)|| (s_eq(sol, "platano") && has("banana"))) {
            say("¡Correcto!  Eres muy listo.|¡Exacto! Muy bien.");
            juego = J_NADA;
            return 1;
        }
        if (match("me rindo|no se|respuesta|solucion|dimelo|no lo se")) {
            out_s("Era: ");
            out_s(sol);
            out_s(". ¿Otra? Escribe \"adivinanza\".");
            juego = J_NADA;
            return 1;
        }
        if (!match("adivinanza*") && nw <= 2) {
            out_s("Mmm, no. ¡Prueba otra vez! (o escribe \"me rindo\")");
            return 1;
        }
        juego = J_NADA; /* ha cambiado de tema */
    }
    if (match("adivina|adivinar|juguemos|jugar|juego") && !match("adivinanza*|piedra|papel|tijera*")) {
        juego = J_ADIVINA;
        secreto = rnd_range(1, 100);
        intentos = 0;
        out_s("¡Vale! He pensado un número del 1 al 100. ¡Adivínalo! Escribe un número (usa F1 para cambiar a 123).");
        return 1;
    }
    if (match("adivinanza*|acertijo")) {
        int k = rnd_range(0, NADIV - 1);
        if (k == adivinanza_actual) k = (k + 1) % NADIV;
        adivinanza_actual = k;
        juego = J_ADIVINANZA;
        out_s("Adivinanza: ");
        out_s(adivinanzas[k][0]);
        return 1;
    }
    return 0;
}

static int manejar_gustos(void)
{
    int i;
    char resto[64];
    if ((i = widx("no me gusta*")) >= 0) {
        rest_from(i + 3, resto, sizeof(resto));
        if (!resto[0]) return 0;
        reflect(resto, sizeof(resto));
        out_s("Entiendo, no te gusta ");
        out_s(resto);
        out_s(". ¿Qué es lo que menos te gusta de eso?");
        return 1;
    }
    if ((i = widx("me gusta*")) >= 0|| (i = widx("me encanta*")) >= 0) {
        rest_from(i + 2, resto, sizeof(resto));
        if (!resto[0]) return 0;
        reflect(resto, sizeof(resto));
        s_copy(gusto, resto, sizeof(gusto));
        switch (rnd() % 3) {
        case 0: out_s("¡A mí también me gusta "); out_s(resto); out_s("!"); break;
        case 1: out_s("¡Qué bien! Me apunto que te gusta "); out_s(resto); out_s("."); break;
        default: out_s("¿Y qué es lo que más te gusta de "); out_s(resto); out_s("?"); break;
        }
        return 1;
    }
    return 0;
}

/* Respuestas tipo ELIZA */
static int manejar_eliza(void)
{
    int i;
    char resto[96];
    if ((i = widx("me siento")) >= 0) {
        rest_from(i + 2, resto, sizeof(resto));
        reflect(resto, sizeof(resto));
        if (!resto[0]) return 0;
        out_s("¿Por qué te sientes ");
        out_s(resto);
        out_s("?");
        return 1;
    }
    if ((i = widx("estoy")) >= 0 && i + 1 < nw) {
        rest_from(i + 1, resto, sizeof(resto));
        reflect(resto, sizeof(resto));
        say("¿Por qué estás |¿Desde cuándo estás |¿Y cómo te hace sentir estar ");
        out_s(resto);
        out_s("?");
        return 1;
    }
    if ((i = widx("quiero")) >= 0 && i + 1 < nw) {
        rest_from(i + 1, resto, sizeof(resto));
        reflect(resto, sizeof(resto));
        say("¿Para qué quieres |¿Qué harías si consiguieras |¿Por qué es importante para ti ");
        out_s(resto);
        out_s("?");
        return 1;
    }
    if ((i = widx("necesito")) >= 0 && i + 1 < nw) {
        rest_from(i + 1, resto, sizeof(resto));
        reflect(resto, sizeof(resto));
        out_s("¿De verdad necesitas ");
        out_s(resto);
        out_s("?");
        return 1;
    }
    if ((i = widx("odio")) >= 0 && i + 1 < nw) {
        rest_from(i + 1, resto, sizeof(resto));
        reflect(resto, sizeof(resto));
        out_s("Odiar es una palabra fuerte. ¿Qué te molesta de ");
        out_s(resto);
        out_s("?");
        return 1;
    }
    if ((i = widx("yo soy")) >= 0|| ((i = widx("soy")) == 0)) {
        int k = s_eq(words[i], "yo") ? i + 2 : i + 1;
        if (k >= nw) return 0;
        rest_from(k, resto, sizeof(resto));
        reflect(resto, sizeof(resto));
        say("¿Por qué dices que eres |¿Desde cuándo eres |¿Te gusta ser ");
        out_s(resto);
        out_s("?");
        return 1;
    }
    if (widx("porque") == 0) {
        say("¿Esa es la verdadera razón?|Entiendo. ¿Y hay alguna otra razón?|Tiene sentido.");
        return 1;
    }
    if (match("no se|ni idea|no lo se")) {
        say("No pasa nada por no saberlo. ¿Quieres que te ayude a averiguarlo?|Tranquilo, a veces lo mejor es preguntar.");
        return 1;
    }
    if (nw == 1 && (s_eq(words[0], "si")|| s_eq(words[0], "vale")|| s_eq(words[0], "ok")|| s_eq(words[0], "claro"))) {
        say("¡Genial! ¿Qué hacemos? Escribe \"ayuda\" para ver ideas.|¡Perfecto!|Vale ");
        return 1;
    }
    if (nw == 1 && s_eq(words[0], "no")) {
        say("Vale, como quieras.|De acuerdo. ¿Hablamos de otra cosa?|Está bien.");
        return 1;
    }
    return 0;
}

static void respuesta_por_defecto(void)
{
    static const char *const genericas =
        "Interesante... cuéntame más.|"
        "No estoy segura de entenderte. ¿Puedes decirlo de otra forma?|"
        "Mmm, eso no lo sé. Prueba a preguntarme de mates, ciencia o geografía.|"
        "¿Y eso qué significa para ti, {n}?|"
        "Todavía estoy aprendiendo. Escribe \"ayuda\" para ver lo que sé hacer.|"
        "Vaya, esa no me la sé. ¿Te cuento un dato curioso en su lugar?|"
        "Ajá. ¿Y por qué lo dices?";
    say(genericas);
}

/* ------------------------------------------------------------------ */

void ia_iniciar(unsigned int semilla)
{
    rnd_state = semilla ^ 0x5A17u;
    rnd();
    nombre[0] = 0;
    gusto[0] = 0;
    edad = -1;
    juego = J_NADA;
    adivinanza_actual = -1;
    turnos = 0;
}

void ia_responder(const char *entrada, char *salida, int max)
{
    int i, tipo;
    char expr[200];

    out_reset(salida, max);
    tokenize(entrada);
    turnos++;
    rnd_state += (unsigned)turnos * 7u;

    if (nw == 0) { out_s("Escribe algo, ¡no muerdo! "); return; }

    /* juegos activos primero */
    if (manejar_juegos()) return;

    /* matematicas */
    tipo = build_expr(expr, sizeof(expr));
    if (tipo == 2) { if (responder_ecuacion(expr)) return; }
    else if (tipo == 1) { if (responder_mates(expr)) return; }

    if (manejar_preguntas_memoria()) return;
    if (manejar_nombre()) return;
    if (manejar_edad()) return;
    if (manejar_hora()) return;
    if (manejar_azar()) return;
    if (manejar_ppt()) return;

    /* reglas de conocimiento */
    for (i = 0; i < NREGLAS; i++) {
        if (match(reglas[i].pat)) {
            /* si la frase es larga y la regla es un saludo, preferir otras cosas */
            if (i == 0 && nw > 3) {
                int j, otra = 0;
                for (j = 1; j < NREGLAS; j++) if (match(reglas[j].pat)) { otra = 1; break; }
                if (otra) continue;
                /* saludo + algo mas: saluda y sigue con ELIZA */
            }
            ultima_regla = i;
            say(reglas[i].resp);
            return;
        }
    }

    if (manejar_gustos()) return;
    if (manejar_eliza()) return;
    respuesta_por_defecto();
}
