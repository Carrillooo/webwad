#!/usr/bin/env node
/**
 * Autoriza Google UNA sola vez y te da el GOOGLE_REFRESH_TOKEN.
 *
 *   npm run google:token
 *
 * Desde ese momento ZERO entra en tu cuenta solo, sin botón de "Conectar".
 * Escucha en el mismo redirect que ya tienes dado de alta en Google Cloud
 * (http://localhost:3000/api/google/callback), así que no hay que tocar nada
 * allí — pero cierra antes `npm run dev`, que usa ese puerto.
 *
 * El refresh token es una llave permanente a tu cuenta: pégalo en .env.local
 * (y en Vercel), nunca en el repositorio.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

// Mismos permisos que src/lib/google/oauth.ts (GOOGLE_SCOPES).
const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/spreadsheets",
  "openid",
  "email",
];

function loadEnvLocal() {
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const value = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[m[1]]) process.env[m[1]] = value;
    }
  } catch {
    /* sin .env.local: se usarán las variables del entorno */
  }
}

function openBrowser(url) {
  const cmd =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", url]]
    : process.platform === "darwin" ? ["open", [url]]
    : ["xdg-open", [url]];
  try {
    spawn(cmd[0], cmd[1], { detached: true, stdio: "ignore" }).unref();
  } catch {
    /* si no abre, el enlace ya está impreso */
  }
}

loadEnvLocal();

const clientId = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
const redirectUri = (process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/google/callback").trim();

if (!clientId || !clientSecret) {
  console.error("\n❌ Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en .env.local\n");
  process.exit(1);
}

let port = 3000;
let path = "/api/google/callback";
try {
  const u = new URL(redirectUri);
  port = Number(u.port || (u.protocol === "https:" ? 443 : 80));
  path = u.pathname;
} catch {
  console.error(`\n❌ GOOGLE_REDIRECT_URI no es una URL válida: ${redirectUri}\n`);
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    // Obligatorio: sin prompt=consent Google no devuelve refresh token si ya
    // habías autorizado antes.
    prompt: "consent",
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname !== path) {
    res.writeHead(404).end("no");
    return;
  }

  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const reply = (msg) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      `<meta charset="utf-8"><body style="background:#0a0a0a;color:#eee;font:16px system-ui;display:grid;place-items:center;height:100vh">
       <p>${msg}</p></body>`,
    );
  };

  if (error || !code) {
    reply("Autorización cancelada. Puedes cerrar esta pestaña.");
    console.error(`\n❌ Google devolvió: ${error ?? "sin código"}\n`);
    server.close();
    process.exit(1);
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const data = await tokenRes.json();
    if (!tokenRes.ok || !data.refresh_token) {
      reply("No se pudo obtener el token. Mira la terminal.");
      console.error(`\n❌ Google ${tokenRes.status}: ${JSON.stringify(data).slice(0, 400)}`);
      console.error(
        "\nSi no viene refresh_token: entra en https://myaccount.google.com/permissions,\n" +
          "quita el acceso a la app y vuelve a ejecutar este comando.\n",
      );
      server.close();
      process.exit(1);
    }

    // La cuenta se saca del id_token (no hace falta otra llamada).
    let email = "";
    try {
      const payload = JSON.parse(Buffer.from(data.id_token.split(".")[1], "base64").toString("utf8"));
      email = payload.email ?? "";
    } catch {
      /* el email es informativo */
    }

    reply("✅ Listo. Vuelve a la terminal y copia las dos líneas.");
    console.log("\n─────────────────────────────────────────────────────────");
    console.log(" Pega esto en .env.local (y en Vercel → Environment Variables):\n");
    if (email) console.log(`GOOGLE_ACCOUNT_EMAIL=${email}`);
    console.log(`GOOGLE_REFRESH_TOKEN=${data.refresh_token}`);
    console.log("\n─────────────────────────────────────────────────────────");
    console.log(" Reinicia la web y Google quedará enlazado para siempre.");
    console.log(" IMPORTANTE: si la pantalla de consentimiento sigue en «Testing»,");
    console.log(" Google caduca este token a los 7 días. Publícala en producción:");
    console.log(" Google Cloud → APIs y servicios → Pantalla de consentimiento → PUBLICAR.\n");
    server.close();
    process.exit(0);
  } catch (e) {
    reply("Error de red. Mira la terminal.");
    console.error("\n❌", e);
    server.close();
    process.exit(1);
  }
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(
      `\n❌ El puerto ${port} está ocupado (seguramente por 'npm run dev').\n   Ciérralo y vuelve a ejecutar 'npm run google:token'.\n`,
    );
  } else {
    console.error("\n❌", e);
  }
  process.exit(1);
});

server.listen(port, () => {
  console.log("\n1) Se abrirá el navegador. Inicia sesión con la cuenta de Daniel");
  console.log("   y acepta los permisos (Calendar, Tasks, Drive, Docs, Sheets).");
  console.log("2) Vuelve aquí: te imprimo el token.\n");
  console.log(`Si no se abre solo, entra en:\n${authUrl}\n`);
  openBrowser(authUrl);
});
