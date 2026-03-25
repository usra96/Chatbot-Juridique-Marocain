# Chatbot Juridique Marocain

Application locale complete (backend + frontend) qui interroge une IA locale via Ollama (modele `mistral`).

## Architecture

```
/chatbot-juridique
  /backend
    server.js
    routes/chat.js
    package.json
  /frontend
    /public
      index.html
    /src
      App.js
      App.css
      index.js
      index.css
      components/ChatBox.js
      components/ChatBox.css
    package.json
    .env
  README.md
```

## Prerequis

- Node.js (LTS conseille)
- Ollama installe en local (voir `https://ollama.com`)

## Installation Ollama

```
ollama pull mistral
```

## Lancement du backend

```
cd chatbot-juridique\backend
npm install
node server.js
```

Le backend ecoute sur `http://localhost:3000`.

## Lancement du frontend

```
cd chatbot-juridique\frontend
npm install
npm start
```

Le frontend demarre par defaut sur `http://localhost:3001` (fichier `.env`).

## Test complet

1. Verifiez qu'Ollama est lance.
2. Lancez le backend.
3. Lancez le frontend.
4. Ouvrez `http://localhost:3001` et posez une question.

## Configuration (optionnel)

Variables d'environnement disponibles pour le backend :

- `OLLAMA_URL` (defaut `http://localhost:11434/api/generate`)
- `OLLAMA_MODEL` (defaut `mistral`)
- `OLLAMA_TIMEOUT_MS` (defaut `20000`)
- `FRONTEND_ORIGIN` (defaut `http://localhost:3001`)

## Notes d'extension (RAG)

Le backend contient un espace reserve pour inserer du contexte documentaire (RAG). Vous pouvez y brancher une lecture de PDF ou une base de donnees vectorielle, puis enrichir `buildPrompt()` dans `routes/chat.js`.
