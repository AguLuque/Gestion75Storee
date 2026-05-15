import pool from "../config/db.js";

const DeudorModel = {
  getAll: async () => {
    const { rows } = await pool.query(
      `SELECT * FROM deudores WHERE activo = true ORDER BY plazo ASC NULLS LAST`
    );
    return rows;
  },

  create: async ({ nombre, monto, plazo, observaciones }) => {
    const { rows } = await pool.query(
      `INSERT INTO deudores (nombre, monto, plazo, observaciones)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nombre, monto, plazo || null, observaciones || null]
    );
    return rows[0];
  },

  update: async (id, { nombre, monto, plazo, observaciones }) => {
    const { rows } = await pool.query(
      `UPDATE deudores SET nombre=$1, monto=$2, plazo=$3, observaciones=$4
       WHERE id=$5 AND activo=true RETURNING *`,
      [nombre, monto, plazo || null, observaciones || null, id]
    );
    return rows[0] || null;
  },

  delete: async (id) => {
    const { rows } = await pool.query(
      `UPDATE deudores SET activo=false WHERE id=$1 AND activo=true RETURNING id`,
      [id]
    );
    return rows[0] || null;
  },
};

export default DeudorModel;