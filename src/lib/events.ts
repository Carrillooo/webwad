/**
 * Eventos internos del navegador. Evitan pasar callbacks por media docena de
 * componentes solo para que un botón hondo pueda hablarle a ZERO.
 * (El de fin de habla vive en useAssistant, junto a quien lo emite.)
 */

/** Pide a ZERO que procese un texto, como si lo hubieras dicho. detail = string. */
export const ASK_EVENT = "nova:ask";
