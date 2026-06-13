import React, { useState, useEffect, useRef } from 'react';
import { Send, Shield, Info } from 'lucide-react';

export default function ChatCenter({ 
  chatHistory, 
  activeChatId, 
  setActiveChatId, 
  sendMessage, 
  user,
  onLocalNudge,
  playMsnNudgeSound,
  onDeleteChat
}) {
  const [inputText, setInputText] = useState('');
  const messagesBoxRef = useRef(null);

  const activeConversation = chatHistory.find(chat => chat.id === activeChatId) || chatHistory[0];

  const scrollToBottom = () => {
    if (messagesBoxRef.current) {
      messagesBoxRef.current.scrollTop = messagesBoxRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    sendMessage(activeConversation.id, activeConversation.sellerAlias, inputText);
    setInputText('');
  };

  const handleSendNudge = () => {
    sendMessage(activeConversation.id, activeConversation.sellerAlias, '[ZUMBIDO]');
    if (playMsnNudgeSound) playMsnNudgeSound();
    if (onLocalNudge) onLocalNudge();
  };

  if (!activeConversation) {
    return (
      <div className="cgi-form-box" style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
        <Info size={32} style={{ margin: '0 auto 12px', color: 'var(--accent-blue)' }} />
        <h3>Ningún Canal Abierto de MSN Messenger</h3>
        <p style={{ marginTop: '6px', fontSize: '11px' }}>Haz clic en "Contactar al vendedor" desde la página de un artículo para abrir un chat seguro.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="view-header">
        <div>
          <h2 className="view-title">AIM / MSN Messenger Descentralizado</h2>
          <p className="view-subtitle">Mensajería directa encriptada en canal local de punto a punto (P2P)</p>
        </div>
      </div>

      <div className="msn-messenger">
        {/* Friends list sidebar */}
        <div className="msn-sidebar">
          <div className="msn-user-profile">
            <div className="msn-avatar">{user.profileData.avatar || '👤'}</div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#000', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.username} (Online)
              </div>
              <div style={{ fontSize: '9px', color: '#666' }}>{user.profileData.location}</div>
            </div>
          </div>

          <div style={{ borderBottom: '1px solid #b7cde6', paddingBottom: '4px', marginBottom: '8px', fontSize: '9px', color: '#555', fontWeight: 'bold' }}>
            MIS CONTACTOS DE CHAT ({chatHistory.length})
          </div>

          <div className="msn-friend-list">
            {chatHistory.map((chat) => (
              <div
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={`msn-friend-item ${chat.id === activeChatId ? 'active' : ''}`}
              >
                <div className="msn-status-dot msn-status-online" />
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                  <span style={{ fontWeight: 'bold' }}>{chat.sellerAlias}</span>
                  {chat.productTitle && (
                    <span style={{ fontSize: '9px', opacity: 0.8, display: 'block' }}>
                      Re: {chat.productTitle.slice(0, 14)}...
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Messaging Box Window */}
        <div className="msn-window">
          
          {/* Header Classic blue */}
          <div className="msn-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Conversación con {activeConversation.sellerAlias}</span>
            {onDeleteChat && (
              <button 
                onClick={() => onDeleteChat(activeConversation.sellerAlias)}
                style={{
                  backgroundColor: '#e53935',
                  color: '#fff',
                  border: '1px solid #b71c1c',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontFamily: '"MS Sans Serif", Geneva, sans-serif',
                  boxShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                  marginRight: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                🗑️ Borrar Chat
              </button>
            )}
          </div>

          {/* Messages Feed */}
          <div className="msn-messages-box" ref={messagesBoxRef}>
            {activeConversation.messages.length === 0 ? (
              <div style={{ textAlign: 'center', margin: 'auto', color: '#888' }}>
                <span style={{ fontSize: '24px' }}>🛡️</span>
                <p style={{ fontSize: '11px', marginTop: '6px' }}>Canal de mensajería cifrado e inmutable en el servidor Kraken.</p>
              </div>
            ) : (
              activeConversation.messages.map((msg, index) => {
                const isUser = msg.sender === 'user';
                return (
                  <div 
                    key={index} 
                    className={`msn-msg ${isUser ? 'msn-msg-user' : 'msn-msg-seller'}`}
                  >
                    <span className="msn-msg-name">
                      {isUser ? user.username : activeConversation.sellerAlias} dice:
                    </span>
                    <div className="msn-msg-text" style={{ fontFamily: 'Arial, sans-serif', color: '#000' }}>
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* MSN Typing input panel */}
          <div style={{ padding: '4px 8px', backgroundColor: '#eef3f7', borderTop: '1px solid #b7cde6', borderBottom: '1px solid #b7cde6', display: 'flex', gap: '6px' }}>
            <button 
              type="button" 
              onClick={handleSendNudge} 
              className="cgi-btn"
              style={{ fontSize: '10px', padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              🔔 Enviar Zumbido
            </button>
          </div>
          <form onSubmit={handleSend} className="msn-input-area">
            <textarea
              placeholder="Escribe tu mensaje y presiona Enter..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
            />
            <button type="submit" className="msn-btn">
              Enviar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
