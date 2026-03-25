import React, { useEffect, useRef, useState } from 'react';
import './ChatBox.css';

const API_URL = 'http://localhost:3000/chat';
const API_STREAM_URL = 'http://localhost:3000/chat/stream';

function ChatBox() {
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      content:
        'Bonjour. Posez-moi une question sur le droit marocain (civil, penal, travail, fiscalite).',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const botId = `${Date.now()}-${Math.random()}`;
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: trimmed },
      { role: 'bot', content: '', id: botId },
    ]);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const response = await fetch(API_STREAM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Stream indisponible');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let done = false;

      while (!done) {
        const result = await reader.read();
        done = result.done;
        const chunk = decoder.decode(result.value || new Uint8Array(), { stream: !done });
        buffer += chunk;

        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        parts.forEach((part) => {
          const line = part.trim();
          if (!line.startsWith('data:')) return;
          const data = line.replace(/^data:\s?/, '');
          if (data === '[DONE]') {
            done = true;
            return;
          }

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botId ? { ...msg, content: msg.content + data } : msg
            )
          );
        });
      }
    } catch (err) {
      setError('Erreur serveur');
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botId
            ? { ...msg, content: 'Desole, une erreur est survenue.' }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chatbox">
      <div className="messages">
        {messages.map((msg, idx) => (
          <div
            key={`${msg.role}-${idx}`}
            className={`message ${msg.role === 'user' ? 'user' : 'bot'}`}
          >
            <div className="bubble">{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="message bot">
            <div className="bubble typing">En train de repondre...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="input-area">
        <textarea
          className="input"
          rows="2"
          placeholder="Ecrivez votre question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="send" onClick={handleSend} disabled={loading}>
          Envoyer
        </button>
      </div>

      {error && <div className="error">{error}</div>}
    </div>
  );
}

export default ChatBox;
