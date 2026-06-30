import pool from "../config/db.js";

const DeudorModel = {
  getAll: async (usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM deudores WHERE activo = true AND usuario_id = $1 ORDER BY plazo ASC NULLS LAST`,
      [usuario_id]
    );
    return rows;
  },

  create: async ({ nombre, monto, plazo, observaciones, usuario_id }) => {
    const { rows } = await pool.query(
      `INSERT INTO deudores (nombre, monto, plazo, observaciones, usuario_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, monto, plazo || null, observaciones || null, usuario_id]
    );
    return rows[0];
  },

  update: async (id, { nombre, monto, plazo, observaciones }, usuario_id) => {
    const { rows } = await pool.query(
      `UPDATE deudores SET nombre=$1, monto=$2, plazo=$3, observaciones=$4
     WHERE id=$5 AND activo=true AND usuario_id=$6 RETURNING *`,
      [nombre, monto, plazo || null, observaciones || null, id, usuario_id]
    );
    return rows[0] || null;
  },

  delete: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `UPDATE deudores SET activo=false WHERE id=$1 AND activo=true AND usuario_id=$2 RETURNING id`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },
};

export default DeudorModel;