const axios = require('axios');

const EMBEDDINGS_URL = process.env.OLLAMA_EMBEDDINGS_URL || 'http://127.0.0.1:11434/api/embeddings';
const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
const REQUEST_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 60000);
let configLogged = false;

function logConfigOnce() {
  if (configLogged) return;
  console.log(`🧠 Embeddings config: ${EMBEDDING_MODEL} @ ${EMBEDDINGS_URL}`);
  configLogged = true;
}

async function embedText(text) {
  logConfigOnce();
  try {
    const response = await axios.post(
      EMBEDDINGS_URL,
      {
        model: EMBEDDING_MODEL,
        prompt: text,
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );

    if (!response.data || !Array.isArray(response.data.embedding)) {
      throw new Error('Embedding invalide');
    }

    return response.data.embedding;
  } catch (err) {
    if (err.response) {
      console.error('❌ Erreur embeddings:', err.response.status, err.response.data);
    } else {
      console.error('❌ Erreur embeddings:', err.message);
    }
    throw err;
  }
}

async function embedDocuments(documents) {
  const embeddings = [];

  console.log(`🧠 Generation embeddings: ${documents.length} chunks`);

  for (let i = 0; i < documents.length; i += 1) {
    const doc = documents[i];
    try {
      const vector = await embedText(doc.text);
      embeddings.push(vector);
    } catch (err) {
      console.error('❌ Erreur embeddings:', err.message);
      throw err;
    }
  }

  console.log(`🧠 Embeddings generes: ${embeddings.length}`);
  return embeddings;
}

module.exports = {
  embedText,
  embedDocuments,
  EMBEDDING_MODEL,
};
