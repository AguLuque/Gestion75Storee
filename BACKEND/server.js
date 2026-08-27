import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import os from "os";
import { connectDB } from "./src/config/db.js";
import errorHandler from "./src/middleware/errorHandler.js";
import routes from "./src/routes/index.js";
import { requestLogger } from "./src/middleware/logger.middleware.js";

// Direcciones IPv4 de la red local (para conectarse desde el celular, por ejemplo)
const obtenerIpsLocales = () => {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const nombre of Object.keys(interfaces)) {
    for (const iface of interfaces[nombre]) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
};

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use("/api", routes);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0"; // escucha en todas las interfaces de red, no solo localhost

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, HOST, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
      for (const ip of obtenerIpsLocales()) {
        console.log(`Accesible en la red local en http://${ip}:${PORT}`);
      }
    });

  } catch (error) {
    console.error("Error al iniciar el servidor:", error.message);
    process.exit(1);
  }
};

startServer();
