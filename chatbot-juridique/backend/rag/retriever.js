const { loadPdfDocuments, getPdfSignatures } = require('./pdfLoader');
const { embedDocuments, embedText, EMBEDDING_MODEL } = require('./embedder');
const { VectorStore } = require('./vectorStore');

const MAX_CONTEXT_CHARS = 1500;
const TOP_K = 3;
const FORCE_REBUILD = (process.env.FORCE_REBUILD_VECTOR_STORE || 'true')
  .toLowerCase()
  .trim() === 'true';

const KEYWORD_FILTERS = [
  {
    name: 'fiscal',
    keywords: ['impot', 'impôt', 'taxe', 'fiscal', 'tva', 'ir', 'is'],
    sources: ['fiscal', 'impot', 'taxe', 'tva'],
  },
  {
    name: 'travail',
    keywords: ['travail', 'salarie', 'salarié', 'contrat', 'licenciement', 'emploi', 'cnss'],
    sources: ['travail', 'salarie', 'emploi', 'code_travail'],
  },
  {
    name: 'penal',
    keywords: ['penal', 'pénal', 'crime', 'delit', 'délit', 'infraction', 'procedure'],
    sources: ['penal', 'code_penal', 'infraction'],
  },
  {
    name: 'civil',
    keywords: ['civil', 'contrat', 'obligation', 'responsabilite', 'responsabilité', 'famille', 'mariage', 'divorce', 'succession'],
    sources: ['civil', 'famille', 'mariage', 'divorce', 'succession'],
  },
];

let storeInstance = null;
let ragReady = null;

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function detectFilter(question) {
  const normalized = normalize(question);
  return KEYWORD_FILTERS.find((filter) =>
    filter.keywords.some((kw) => normalized.includes(normalize(kw)))
  );
}

function filterBySources(docs, patterns) {
  if (!patterns || patterns.length === 0) return docs;
  const normalizedPatterns = patterns.map((p) => normalize(p));
  return docs.filter((doc) => {
    const source = normalize(doc.metadata?.source || '');
    return normalizedPatterns.some((pattern) => source.includes(pattern));
  });
}

function buildContext(chunks) {
  return chunks.map((chunk) => chunk.text).join('\n').slice(0, MAX_CONTEXT_CHARS);
}

function dedupeByText(chunks) {
  const seen = new Set();
  return chunks.filter((chunk) => {
    const key = chunk.text.slice(0, 200);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function truncate(text, maxLength = 200) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

async function buildOrLoadVectorStore() {
  if (!storeInstance) storeInstance = new VectorStore();

  const currentSignatures = getPdfSignatures();

  if (!FORCE_REBUILD) {
    const loaded = storeInstance.loadFromDisk();

    if (loaded) {
      const sameModel = storeInstance.meta.embeddingModel === EMBEDDING_MODEL;
      const sameSources =
        JSON.stringify(storeInstance.meta.sources || {}) === JSON.stringify(currentSignatures);

      if (sameModel && sameSources && storeInstance.documents.length > 0) {
        console.log('📦 Vector store charge depuis le disque');
        return storeInstance;
      }

      console.log('🔄 Changement detecte, reconstruction du vector store...');
      storeInstance.clear();
    }
  } else {
    console.log('♻️ Reconstruction forcee du vector store');
    storeInstance.clear();
  }

  const documents = await loadPdfDocuments();
  if (documents.length === 0) {
    storeInstance.meta = {
      sources: currentSignatures,
      embeddingModel: EMBEDDING_MODEL,
      createdAt: new Date().toISOString(),
    };
    storeInstance.saveToDisk();
    return storeInstance;
  }

  const embeddings = await embedDocuments(documents);
  storeInstance.upsert(documents, embeddings);
  storeInstance.meta = {
    sources: currentSignatures,
    embeddingModel: EMBEDDING_MODEL,
    createdAt: new Date().toISOString(),
  };
  storeInstance.saveToDisk();
  console.log('📦 Vector store pret');

  return storeInstance;
}

async function ensureRagReady() {
  if (!ragReady) {
    ragReady = buildOrLoadVectorStore();
  }
  return ragReady;
}

async function retrieveRelevantChunks(question) {
  const startTime = Date.now();
  console.log(`❓ Question: ${question}`);
  const store = await ensureRagReady();

  if (!store.documents.length) {
    return { context: '', chunks: [] };
  }

  const filter = detectFilter(question);
  let candidates = store.documents;

  if (filter) {
    candidates = filterBySources(store.documents, filter.sources);
    console.log(`🧭 Filtre sujet: ${filter.name}`);
  }

  if (candidates.length === 0) {
    candidates = store.documents;
  }

  console.log(`📚 Chunks candidats: ${candidates.length}`);

  const queryEmbedding = await embedText(question);
  const rawResults = store.similaritySearchInDocs(candidates, queryEmbedding, TOP_K);
  const results = dedupeByText(rawResults);
  const topChunks = results.slice(0, 3);
  const context = topChunks
    .map((c) => c.text)
    .join('\n')
    .slice(0, 1500); // LIMITE IMPORTANTE

  console.log(`🔎 Chunks trouves: ${topChunks.length}`);
  console.log(`📏 Taille contexte: ${context.length} chars`);
  console.log(`📚 Contexte extrait: "${truncate(context, 200)}"`);
  console.log(`⏱ Temps retrieval: ${Date.now() - startTime}ms`);

  return { context, chunks: topChunks };
}

module.exports = {
  ensureRagReady,
  retrieveRelevantChunks,
};
