import React from 'react';
import ChatBox from './components/ChatBox';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Chatbot Juridique Marocain</h1>
        <p>Assistant IA local pour le droit marocain</p>
      </header>
      <main className="app-main">
        <ChatBox />
      </main>
    </div>
  );
}

export default App;
