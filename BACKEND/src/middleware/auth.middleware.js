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

    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: "Token inválido o expirado" });
    }

    req.usuario_id = data.user.id;
    req.usuario_email = data.user.email;

    next();
  } catch (err) {
    console.error("Error en requireAuth:", err.message);
    return res.status(500).json({ error: "Error al validar autenticación" });
  }
};