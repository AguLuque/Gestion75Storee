import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false,
  },

  max: process.env.DB_POOL_MAX || 10, // máximo de conexiones
  idleTimeoutMillis: process.env.DB_IDLE_TIMEOUT || 30000,
  connectionTimeoutMillis: process.env.DB_CONNECTION_TIMEOUT || 2000,
});

// 🔍 Test inicial de conexión
const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log("PostgreSQL conectado correctamente");
    client.release();
  } catch (error) {
    console.error("Error al conectar a la DB:", error.message);
    process.exit(1);
  }
};

export { connectDB };
export default pool;