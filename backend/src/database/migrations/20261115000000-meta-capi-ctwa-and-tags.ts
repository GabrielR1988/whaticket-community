import { QueryInterface, DataTypes } from "sequelize";

// Meta Conversions API:
// - Contacts.ctwaClid: click ID del anuncio Click-to-WhatsApp por el que llego el contacto.
// - Etiquetas "Contacto" y "Venta" (disparan los eventos Lead y Purchase), si no existen.
const DEFAULT_TAGS = [
  { name: "Contacto", color: "#1E88E5" },
  { name: "Venta", color: "#43A047" }
];

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Contacts", "ctwaClid", {
      type: DataTypes.STRING,
      allowNull: true
    });

    const [rows] = await queryInterface.sequelize.query(
      "SELECT LOWER(name) AS name FROM Tags"
    );
    const existing = (rows as { name: string }[]).map(r => r.name);
    const now = new Date();
    const missing = DEFAULT_TAGS.filter(
      tag => !existing.includes(tag.name.toLowerCase())
    ).map(tag => ({ ...tag, createdAt: now, updatedAt: now }));
    if (missing.length) await queryInterface.bulkInsert("Tags", missing);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Contacts", "ctwaClid");
  }
};
