"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

/**
 * Panel de administración — SOLO la cuenta máster lo ve (la API devuelve 403
 * a cualquier otra). Gestiona cuentas y suscripciones sin tocar la base a mano.
 */

interface AdminUser {
  id: string;
  email: string;
  name: string;
  isOwner: boolean;
  createdAt: string;
  subscription: { status: "active" | "trial" | "expired"; daysLeft: number | null };
}

interface AdminData {
  users: AdminUser[];
  stats: { total: number; activas: number; prueba: number; caducadas: number };
}

const ESTADO: Record<string, { label: string; color: string }> = {
  active: { label: "Activa", color: "rgb(52 211 153)" },
  trial: { label: "Prueba", color: "rgb(251 191 36)" },
  expired: { label: "Caducada", color: "rgb(248 113 113)" },
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass holo-border rounded-2xl px-4 py-3 text-center">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-[11px] text-faint uppercase tracking-wide">{label}</div>
    </div>
  );
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [denied, setDenied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/users");
    if (r.status === 403) {
      setDenied(true);
      return;
    }
    setData(await r.json().catch(() => null));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (userId: string, action: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(userId);
    try {
      await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (denied) {
    return (
      <main className="min-h-[100dvh] grid place-items-center px-5">
        <div className="glass holo-border rounded-2xl p-6 text-center space-y-2 max-w-sm">
          <h1 className="text-lg font-semibold">Solo la cuenta máster</h1>
          <p className="text-sm text-dim">
            Inicia sesión con la cuenta principal de ZERO y vuelve a abrir /admin.
          </p>
          <Link href="/" className="inline-block text-sm mt-1" style={{ color: "rgb(var(--nova-accent))" }}>
            ← Volver a ZERO
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] px-4 py-6 max-w-3xl mx-auto space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold glow-text">ZERO · Administración</h1>
        <Link href="/" className="text-sm" style={{ color: "rgb(var(--nova-accent))" }}>
          ← Volver
        </Link>
      </header>

      {!data ? (
        <p className="text-sm text-faint">Cargando…</p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2">
            <Stat label="Cuentas" value={data.stats.total} />
            <Stat label="Activas" value={data.stats.activas} />
            <Stat label="En prueba" value={data.stats.prueba} />
            <Stat label="Caducadas" value={data.stats.caducadas} />
          </div>

          <div className="glass holo-border rounded-2xl overflow-hidden divide-y divide-[rgb(var(--nova-fg)/0.08)]">
            {data.users.length === 0 && (
              <p className="px-4 py-6 text-sm text-faint text-center">
                No hay ninguna cuenta todavía. La primera que entre será la máster.
              </p>
            )}
            {data.users.map((u) => {
              const e = ESTADO[u.subscription.status];
              return (
                <div key={u.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm truncate">
                      {u.name} {u.isOwner && <span className="text-[10px] px-1.5 py-0.5 rounded-md align-middle" style={{ background: "rgb(var(--nova-accent) / 0.25)" }}>MÁSTER</span>}
                    </div>
                    <div className="text-[11px] text-faint truncate">
                      {u.email} · alta {new Date(u.createdAt).toLocaleDateString("es-ES")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px]" style={{ color: e.color }}>
                      {e.label}
                      {u.subscription.status === "trial" ? ` · ${u.subscription.daysLeft} d` : ""}
                    </span>
                    {!u.isOwner && (
                      <span className={busyId === u.id ? "opacity-40 pointer-events-none" : ""}>
                        {u.subscription.status !== "active" && (
                          <button onClick={() => void act(u.id, "activate")} className="px-2.5 py-1 rounded-lg text-[11px] mr-1.5" style={{ background: "rgb(52 211 153 / 0.18)", color: "rgb(52 211 153)" }}>
                            Activar
                          </button>
                        )}
                        {u.subscription.status !== "expired" && (
                          <button onClick={() => void act(u.id, "revoke", `¿Cortar el acceso a ${u.email}?`)} className="px-2.5 py-1 rounded-lg text-[11px] mr-1.5" style={{ background: "rgb(251 191 36 / 0.15)", color: "rgb(251 191 36)" }}>
                            Cortar
                          </button>
                        )}
                        <button onClick={() => void act(u.id, "extend")} className="px-2.5 py-1 rounded-lg text-[11px] mr-1.5" style={{ background: "rgb(var(--nova-accent) / 0.2)" }}>
                          +14 días
                        </button>
                        <button onClick={() => void act(u.id, "delete", `¿BORRAR ${u.email} y todos sus datos? No se puede deshacer.`)} className="px-2.5 py-1 rounded-lg text-[11px]" style={{ background: "rgb(248 113 113 / 0.15)", color: "rgb(248 113 113)" }}>
                          Borrar
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-faint leading-snug px-1">
            «Activar» da acceso de pago sin caducidad (hasta que exista la pasarela, aquí se
            gestiona el cobro a mano). «Cortar» manda la cuenta al muro de suscripción ya.
            «Borrar» elimina la cuenta y todos sus datos, incluidas sus conexiones de Google/Outlook.
          </p>
        </>
      )}
    </main>
  );
}
