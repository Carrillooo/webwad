#ifndef IA_H
#define IA_H

#define IA_MAX_RESP 420

/* Inicializa el motor (semilla aleatoria) */
void ia_iniciar(unsigned int semilla);

/* Genera la respuesta (UTF-8) a lo que ha escrito el usuario */
void ia_responder(const char *entrada, char *salida, int max);

/* Lo implementa la plataforma: hora actual. Devuelve 0 si no disponible. */
int ia_hora(int *h, int *m);

#endif
