const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, 'vector_store.json');

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

class VectorStore {
  constructor(storePath = STORE_PATH) {
    this.storePath = storePath;
    this.documents = [];
    this.meta = {
      sources: {},
      embeddingModel: null,
      createdAt: null,
    };
  }

  loadFromDisk() {
    if (!fs.existsSync(this.storePath)) return false;
    const raw = fs.readFileSync(this.storePath, 'utf8');
    if (!raw) return false;

    const parsed = JSON.parse(raw);
    this.documents = parsed.documents || [];
    this.meta = parsed.meta || this.meta;
    console.log(`📦 Vector store charge: ${this.documents.length} vecteurs`);
    return true;
  }

  saveToDisk() {
    const payload = {
      meta: this.meta,
      documents: this.documents,
    };
    fs.writeFileSync(this.storePath, JSON.stringify(payload, null, 2), 'utf8');
    console.log('📦 Vector store sauvegarde');
  }

  clear() {
    this.documents = [];
    this.meta = {
      sources: {},
      embeddingModel: null,
      createdAt: null,
    };
  }

  upsert(documents, embeddings) {
    documents.forEach((doc, idx) => {
      this.documents.push({
        id: doc.id,
        text: doc.text,
        metadata: doc.metadata,
        embedding: embeddings[idx],
      });
    });
  }

  similaritySearch(queryEmbedding, topK = 4) {
    return this.similaritySearchInDocs(this.documents, queryEmbedding, topK);
  }

  similaritySearchInDocs(docs, queryEmbedding, topK = 4) {
    const scored = docs.map((doc) => ({
      ...doc,
      score: cosineSimilarity(queryEmbedding, doc.embedding),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

module.exports = {
  VectorStore,
  STORE_PATH,
};
