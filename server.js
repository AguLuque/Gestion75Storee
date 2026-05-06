import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db.js";
import errorHandler from "./src/middleware/errorHandler.js";

dotenv.config();

const app = express();

// Middlewares básicos
app.use(express.json());
app.use(errorHandler);


// Ruta de prueba
app.get("/", (req, res) => {
  res.send("API funcionando ");
});

// Puerto
const PORT = process.env.PORT || 3000;

// Arranque del servidor + conexión DB
const startServer = async () => {
  try {
    // 1. Conectar a la base de datos
    await connectDB();

    // 2. Levantar servidor SOLO si la DB está OK
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("Error al iniciar el servidor:", error.message);
    process.exit(1);
  }
};

startServer();