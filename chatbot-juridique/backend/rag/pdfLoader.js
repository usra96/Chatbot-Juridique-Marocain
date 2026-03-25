const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DEFAULT_CHUNK_CHARS = 500;
const DEFAULT_CHUNK_OVERLAP = 50;
const MAX_EMBEDDING_CHARS = 500;
const MAX_EMBEDDING_OVERLAP = 50;

function listPdfFiles() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs
    .readdirSync(DATA_DIR)
    .filter((file) => file.toLowerCase().endsWith('.pdf'))
    .map((file) => path.join(DATA_DIR, file));
}

function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\u00ad/g, '')
    .trim();
}

function splitByChars(text, chunkSize, overlap) {
  const cleaned = text.trim();
  if (!cleaned) return [];

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + chunkSize, cleaned.length);

    if (end < cleaned.length) {
      const lastSpace = cleaned.lastIndexOf(' ', end);
      if (lastSpace > start + 50) {
        end = lastSpace;
      }
    }

    const chunkText = cleaned.slice(start, end).trim();
    if (chunkText) chunks.push(chunkText);

    if (end === cleaned.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks;
}

function splitTextIntoChunks(text) {
  return splitByChars(text, DEFAULT_CHUNK_CHARS, DEFAULT_CHUNK_OVERLAP);
}

function enforceMaxChunkSize(chunks) {
  const safeChunks = [];

  chunks.forEach((chunk) => {
    if (chunk.length <= MAX_EMBEDDING_CHARS) {
      safeChunks.push(chunk);
      return;
    }

    const smaller = splitByChars(chunk, MAX_EMBEDDING_CHARS, MAX_EMBEDDING_OVERLAP);
    safeChunks.push(...smaller);
  });

  return safeChunks;
}

async function loadPdfDocuments() {
  const files = listPdfFiles();
  const documents = [];

  if (files.length === 0) {
    console.log('📄 Aucun PDF trouve dans /data');
    return documents;
  }

  console.log(`📁 PDFs detectes: ${files.length}`);
  console.log(`📌 Fichiers: ${files.map((f) => path.basename(f)).join(', ')}`);

  for (const filePath of files) {
    const fileBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(fileBuffer);
    const cleaned = cleanText(pdfData.text || '');
    const initialChunks = splitTextIntoChunks(cleaned);
    const chunks = enforceMaxChunkSize(initialChunks);

    console.log(`📄 PDF charge: ${path.basename(filePath)}`);
    console.log(`📊 Longueur texte: ${cleaned.length} caracteres`);
    const avgSize =
      chunks.length > 0
        ? Math.round(chunks.reduce((sum, c) => sum + c.length, 0) / chunks.length)
        : 0;
    console.log(`🧩 Chunks crees: ${chunks.length} (taille moyenne ~ ${avgSize} chars)`);

    chunks.forEach((chunk, index) => {
      documents.push({
        id: `${path.basename(filePath)}::${index}`,
        text: chunk,
        metadata: {
          source: path.basename(filePath),
          chunk: index,
        },
      });
    });
  }

  return documents;
}

function getPdfSignatures() {
  const files = listPdfFiles();
  const signatures = {};

  files.forEach((filePath) => {
    const stats = fs.statSync(filePath);
    const key = path.basename(filePath);
    signatures[key] = `${stats.size}-${stats.mtimeMs}`;
  });

  return signatures;
}

module.exports = {
  loadPdfDocuments,
  getPdfSignatures,
};
