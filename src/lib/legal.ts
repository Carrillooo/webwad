/**
 * Identificación del titular del servicio.
 *
 * En España, el artículo 10 de la LSSI-CE obliga a que cualquier web con
 * actividad económica muestre, de forma permanente y fácil de encontrar, quién
 * está detrás: nombre o razón social, NIF, domicilio y un contacto directo. El
 * RGPD (art. 13) exige lo mismo para identificar al responsable del
 * tratamiento. No basta con «el titular del servicio».
 *
 * Los datos viven en variables de entorno porque son datos personales o
 * fiscales del titular, y no pintan escritos en el repositorio.
 *
 * Si faltan, las páginas legales lo dicen abiertamente en lugar de inventarse
 * nada: un aviso legal con datos falsos es peor que no tenerlo.
 */

const v = (nombre: string) => (process.env[nombre] ?? "").trim();

export interface Titular {
  nombre: string;
  nif: string;
  domicilio: string;
  email: string;
  telefono: string;
  /** Registro Mercantil u otro, solo si es sociedad. */
  registro: string;
  /** Nombre comercial del servicio. */
  marca: string;
}

export function titular(): Titular {
  return {
    nombre: v("LEGAL_NOMBRE"),
    nif: v("LEGAL_NIF"),
    domicilio: v("LEGAL_DOMICILIO"),
    email: v("LEGAL_EMAIL") || v("SMTP_USER") || "asistentezerodc@gmail.com",
    telefono: v("LEGAL_TELEFONO"),
    registro: v("LEGAL_REGISTRO"),
    marca: v("LEGAL_MARCA") || "ZERO",
  };
}

/** Lo que falta por rellenar para cumplir el artículo 10 de la LSSI. */
export function faltaEnAvisoLegal(t = titular()): string[] {
  const falta: string[] = [];
  if (!t.nombre) falta.push("LEGAL_NOMBRE — tu nombre y apellidos o la razón social");
  if (!t.nif) falta.push("LEGAL_NIF — NIF, NIE o CIF");
  if (!t.domicilio) falta.push("LEGAL_DOMICILIO — domicilio a efectos de notificaciones");
  return falta;
}

/** ¿Se puede publicar el aviso legal tal cual? */
export function avisoLegalCompleto(t = titular()): boolean {
  return faltaEnAvisoLegal(t).length === 0;
}
