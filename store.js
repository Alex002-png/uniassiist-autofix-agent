// Almacén en memoria para fixes pendientes de aprobación
const pending = new Map();

// Auto-limpiar fixes de más de 2 horas
setInterval(() => {
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, fix] of pending.entries()) {
    if (fix.createdAt < twoHoursAgo) pending.delete(id);
  }
}, 30 * 60 * 1000);

module.exports = {
  set: (id, data) => pending.set(id, { ...data, createdAt: Date.now() }),
  get: (id) => pending.get(id),
  delete: (id) => pending.delete(id),
};
