FROM node:18-alpine

WORKDIR /app

# Installer les dependances backend
COPY chatbot-juridique/backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copier le code backend et les donnees PDF
COPY chatbot-juridique/backend ./backend
COPY chatbot-juridique/data ./data

WORKDIR /app/backend

ENV PORT=3000
ENV FORCE_REBUILD_VECTOR_STORE=true

EXPOSE 3000

CMD ["node", "server.js"]
