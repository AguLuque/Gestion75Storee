// src/middlewares/auth.middleware.js
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token no provisto" });
    }

    const token = authHeader.split(" ")[1];

    // getClaims verifica firma y vencimiento del token localmente con las claves
    // públicas del proyecto (se descargan una vez y quedan en caché), sin ir a
    // Supabase en cada request. Si el proyecto todavía firma con el secreto
    // legacy (HS256), getClaims cae solo a getUser(), igual de seguro que antes.
    const { data, error } = await supabaseAdmin.auth.getClaims(token);
    const claims = data?.claims;

    if (error || !claims?.sub || claims.role !== "authenticated") {
      return res.status(401).json({ error: "Token inválido o expirado" });
    }

    req.usuario_id = claims.sub;
    req.usuario_email = claims.email;

    next();
  } catch (err) {
    console.error("Error en requireAuth:", err.message);
    return res.status(500).json({ error: "Error al validar autenticación" });
  }
};