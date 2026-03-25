const app = require('./app');
const { ensureRagReady } = require('./rag/retriever');

const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3001';

app.listen(PORT, () => {
  console.log(`[SERVER] Backend en ecoute sur http://localhost:${PORT}`);
  console.log(`[SERVER] Autorise CORS pour ${FRONTEND_ORIGIN}`);
});

ensureRagReady().catch((err) => {
  console.error('[RAG] Initialisation echouee:', err.message);
});
