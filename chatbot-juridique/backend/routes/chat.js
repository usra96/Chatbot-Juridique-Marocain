const express = require('express');
const axios = require('axios');
const { retrieveRelevantChunks } = require('../rag/retriever');

const router = express.Router();

const SYSTEM_PROMPT = `
Tu es un assistant juridique spécialisé exclusivement en droit marocain.

RÈGLE PRINCIPALE :
Tu dois répondre UNIQUEMENT avec des informations présentes dans les extraits.
Si ce n'est pas le cas, tu ne dois PAS répondre au fond.

RÈGLES STRICTES :
- Interdiction totale d'utiliser des connaissances générales
- Interdiction totale d'inventer des lois ou des articles
- Interdiction de reformuler des connaissances non présentes dans les extraits
- Chaque phrase doit être directement justifiée par le contexte fourni

COMPORTEMENT OBLIGATOIRE :
- Si les extraits ne contiennent pas clairement la réponse :
  → Réponds EXACTEMENT : 'Information non trouvée dans les documents fournis'
- Si la question est hors sujet :
  → 'Je ne peux répondre qu’aux questions relatives au droit marocain'

IMPORTANT :
- Ne tente JAMAIS de compléter ou deviner une réponse
- Ne donne JAMAIS de phrases générales
- Si tu hésites → ne réponds pas

Extraits :
{context}

Question :
{question}

FORMAT DE RÉPONSE :

CAS 1 (information trouvée) :
1. Analyse (1 phrase)
2. Réponse juridique (basée uniquement sur les extraits)
3. Articles (ou : 'Non mentionnés dans les extraits')
4. Limites (1 phrase)

CAS 2 (information absente) :
Information non trouvée dans les documents fournis
`;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';
const REQUEST_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 120000);
const MAX_MESSAGE_LENGTH = 2000;
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '5m';
const OLLAMA_MAX_TOKENS = Number(process.env.OLLAMA_MAX_TOKENS || 800);
const OLLAMA_TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE || 0.2);
const OFF_TOPIC_RESPONSE =
  "Bonjour ! Je ne peux répondre qu’aux questions relatives au droit marocain.";
const GREETINGS = ['bonjour', 'salut', 'hello', 'hi', 'bonsoir', 'coucou', 'yo', 'salam', 'slm'];

function normalizeMessage(message) {
  if (typeof message !== 'string') return '';
  return message.trim();
}

function normalizeForCheck(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGreetingOnly(message) {
  const normalized = normalizeForCheck(message);
  if (!normalized) return false;
  const words = normalized.split(' ').filter(Boolean);
  if (words.length === 0) return false;
  const nonGreeting = words.filter((w) => !GREETINGS.includes(w));
  return nonGreeting.length === 0;
}

function buildPrompt(message, context) {
  return SYSTEM_PROMPT.replace('{context}', context || 'Aucun extrait pertinent.')
    .replace('{question}', message);
}

function truncate(text, maxLength = 500) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

async function getContextForMessage(message) {
  let context = '';
  try {
    const retrieval = await retrieveRelevantChunks(message);
    context = retrieval.context;
  } catch (err) {
    console.error('❌ Erreur retrieval:', err.message);
  }
  return context;
}

router.post('/', async (req, res) => {
  const startTime = Date.now();
  const message = normalizeMessage(req.body?.message);
  if (!message) {
    return res.status(400).json({ error: 'Message requis' });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: 'Message trop long' });
  }

  if (isGreetingOnly(message)) {
    console.log('ℹ️ Salutation detectee, reponse directe.');
    return res.json({ reply: OFF_TOPIC_RESPONSE });
  }

  const context = await getContextForMessage(message);

  const prompt = buildPrompt(message, context);

  try {
    console.log('📤 Prompt envoye:', truncate(prompt, 500));
    console.log('[CHAT] Requete recue, envoi a Ollama...');

    const response = await axios.post(
      OLLAMA_URL,
      {
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        keep_alive: OLLAMA_KEEP_ALIVE,
        options: {
          temperature: OLLAMA_TEMPERATURE,
          num_predict: OLLAMA_MAX_TOKENS,
        },
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );

    if (!response.data || typeof response.data.response !== 'string') {
      console.error('❌ Reponse Ollama invalide:', response.data);
      return res.status(502).json({ error: 'Reponse IA invalide' });
    }

    console.log('📥 Reponse IA:', truncate(response.data.response, 500));
    console.log(`⏱ Temps de reponse: ${Date.now() - startTime}ms`);
    return res.json({ reply: response.data.response.trim() });
  } catch (err) {
    const isTimeout = err.code === 'ECONNABORTED';
    if (isTimeout) {
      console.error('❌ Timeout Ollama');
      return res.status(504).json({ error: 'Timeout IA' });
    }

    if (err.response) {
      console.error('❌ Erreur Ollama:', err.response.status, err.response.data);
      return res.status(502).json({ error: 'Ollama indisponible' });
    }

    console.error('❌ Erreur reseau:', err.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/stream', async (req, res) => {
  const startTime = Date.now();
  const message = normalizeMessage(req.body?.message);
  if (!message) {
    return res.status(400).json({ error: 'Message requis' });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: 'Message trop long' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (isGreetingOnly(message)) {
    console.log('ℹ️ Salutation detectee, reponse directe.');
    res.write(`data: ${OFF_TOPIC_RESPONSE}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  const context = await getContextForMessage(message);
  const prompt = buildPrompt(message, context);

  console.log('📤 Prompt envoye:', truncate(prompt, 500));
  console.log('[CHAT] Requete recue, envoi a Ollama (stream)...');

  try {
    const response = await axios.post(
      OLLAMA_URL,
      {
        model: OLLAMA_MODEL,
        prompt,
        stream: true,
        keep_alive: OLLAMA_KEEP_ALIVE,
        options: {
          temperature: OLLAMA_TEMPERATURE,
          num_predict: OLLAMA_MAX_TOKENS,
        },
      },
      { timeout: REQUEST_TIMEOUT_MS, responseType: 'stream' }
    );

    let buffer = '';
    response.data.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          const payload = JSON.parse(trimmed);
          if (payload.response) {
            res.write(`data: ${payload.response}\n\n`);
          }
          if (payload.done) {
            res.write('data: [DONE]\n\n');
            res.end();
            console.log(`⏱ Temps de reponse: ${Date.now() - startTime}ms`);
          }
        } catch (err) {
          console.error('❌ Erreur parsing stream:', err.message);
        }
      });
    });

    response.data.on('error', (err) => {
      console.error('❌ Erreur stream Ollama:', err.message);
      res.write('data: [DONE]\n\n');
      res.end();
    });

    response.data.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });

    req.on('close', () => {
      response.data.destroy();
    });
  } catch (err) {
    console.error('❌ Erreur Ollama stream:', err.message);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

module.exports = router;
