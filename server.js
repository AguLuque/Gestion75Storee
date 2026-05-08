import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./src/config/db.js";
import errorHandler from "./src/middleware/errorHandler.js";
import routes from "./src/routes/index.js";

dotenv.config();

const app = express();

// Middlewares básicos
app.use(cors());
app.use(express.json());

// Rutas
app.use("/api", routes);

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("API funcionando ✅");
});

// Error handler (siempre al final)
app.use(errorHandler);

// Puerto
const PORT = process.env.PORT || 3000;

// Arranque del servidor + conexión DB
const startServer = async () => {
  try {
    // 1. Conectar a la base de datos
    await connectDB();

    // 2. Levantar servidor SOLO si la DB está OK
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("Error al iniciar el servidor:", error.message);
    process.exit(1);
  }
};

startServer();