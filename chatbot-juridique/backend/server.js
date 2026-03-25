const express = require('express');
const cors = require('cors');
const chatRouter = require('./routes/chat');
const { ensureRagReady } = require('./rag/retriever');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3001';

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: '1mb' }));

app.use('/chat', chatRouter);

app.use((err, req, res, next) => {
  console.error('[SERVER] Erreur non geree:', err);
  res.status(500).json({ error: 'Erreur serveur' });
});

app.listen(PORT, () => {
  console.log(`[SERVER] Backend en ecoute sur http://localhost:${PORT}`);
  console.log(`[SERVER] Autorise CORS pour ${FRONTEND_ORIGIN}`);
});

ensureRagReady().catch((err) => {
  console.error('[RAG] Initialisation echouee:', err.message);
});
