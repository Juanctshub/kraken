import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Marketplace from './components/Marketplace';
import NetworkHub from './components/NetworkHub';
import MyProfile from './components/MyProfile';
import EscrowOrders from './components/EscrowOrders';
import MyStore from './components/MyStore';
import ChatCenter from './components/ChatCenter';
import ProductDetail from './components/ProductDetail';
import CheckoutModal from './components/CheckoutModal';
import LoginRegister from './components/LoginRegister';
import ForumBoard from './components/ForumBoard';

const API_BASE = 'http://localhost:8080/api';

function App() {
  const [currentRoute, setCurrentRoute] = useState('marketplace');
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [checkoutProduct, setCheckoutProduct] = useState(null);
  const [isAppShaking, setIsAppShaking] = useState(false);
  const lastMessageIdRef = useRef(0);

  const playMsnBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(783.99, ctx.currentTime);
      gain1.gain.setValueAtTime(0.08, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.12);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.1);
      gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.1);
      osc2.stop(ctx.currentTime + 0.28);
    } catch (e) {
      console.error("Audio Context beep failed:", e);
    }
  };

  const playMsnNudgeSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(130, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(60, ctx.currentTime + 0.45);
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {
      console.error("Audio Context nudge failed:", e);
    }
  };
  
  // Search & Category Filters
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Shared backend state sync indicators
  const [isServerOffline, setIsServerOffline] = useState(false);

  // DDoS Shield states
  const [isDdosVerifying, setIsDdosVerifying] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [ddosProgress, setDdosProgress] = useState(0);
  const [ddosLogs, setDdosLogs] = useState([]);
  const [verificationStage, setVerificationStage] = useState('challenge'); // 'challenge' or 'js_check'
  const [ddosEmojis, setDdosEmojis] = useState(['🚗', '🐙', '🍎']);
  const [ddosError, setDdosError] = useState('');

  // 1. Session state
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('kraken_session_user');
    return saved ? JSON.parse(saved) : null;
  });

  // 2. Transactions ledger (fetched from server)
  const [transactionHistory, setTransactionHistory] = useState([]);

  // 3. Orders ledger (fetched from server)
  const [orders, setOrders] = useState([]);

  // 4. Encrypted chats history parsed from server messages
  const [chatHistory, setChatHistory] = useState([]);
  const [activeChatId, setActiveChatId] = useState('');

  // Save session to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('kraken_session_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('kraken_session_user');
    }
  }, [user]);


  // --- API ROUTINES (SYNCED WITH EXPRESS SERVER) ---

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE}/products`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProducts(data);
      setIsServerOffline(false);
    } catch (err) {
      setIsServerOffline(true);
    }
  };

  const fetchOrders = async () => {
    if (!user || !user.username) return;
    try {
      const res = await fetch(`${API_BASE}/orders/${user.username}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error("Error syncing orders.");
    }
  };

  const fetchChats = async () => {
    if (!user || !user.username) return;
    try {
      const res = await fetch(`${API_BASE}/chats/${user.username}`);
      if (!res.ok) throw new Error();
      const rawMessages = await res.json();

      // Group raw messages by "other user" in conversation
      const conversationMap = {};

      rawMessages.forEach(msg => {
        const msgFrom = msg.from || '';
        const msgTo = msg.to || '';
        const userUsername = (user && user.username) || '';
        
        if (!msgFrom || !msgTo) return;

        const otherUser = msgFrom.toLowerCase() === userUsername.toLowerCase() ? msgTo : msgFrom;
        const otherUserLower = otherUser.toLowerCase();
        
        if (!conversationMap[otherUser]) {
          conversationMap[otherUser] = {
            id: `chat_${otherUserLower}`,
            sellerAlias: otherUser,
            productTitle: msg.productTitle || '',
            messages: []
          };
        }

        conversationMap[otherUser].messages.push({
          sender: msgFrom.toLowerCase() === userUsername.toLowerCase() ? 'user' : 'seller',
          text: msg.text,
          timestamp: msg.timestamp
        });
      });

      // Play audio alerts and shake on new messages
      if (rawMessages.length > 0) {
        if (lastMessageIdRef.current === 0) {
          lastMessageIdRef.current = rawMessages[rawMessages.length - 1].id;
        } else {
          const lastMsg = rawMessages[rawMessages.length - 1];
          if (lastMsg && lastMsg.id > lastMessageIdRef.current) {
            const lastMsgFrom = lastMsg.from || '';
            const userUsername = (user && user.username) || '';
            if (lastMsgFrom.toLowerCase() !== userUsername.toLowerCase()) {
              if (lastMsg.text === '[ZUMBIDO]') {
                playMsnNudgeSound();
                setIsAppShaking(true);
                setTimeout(() => setIsAppShaking(false), 800);
              } else {
                playMsnBeep();
              }
            }
            lastMessageIdRef.current = lastMsg.id;
          }
        }
      }

      const chatsList = Object.values(conversationMap);
      setChatHistory(prevChats => {
        const mergedList = [...chatsList];
        prevChats.forEach(oldChat => {
          const lowerAlias = (oldChat.sellerAlias || '').toLowerCase();
          const existsInNew = chatsList.some(c => (c.sellerAlias || '').toLowerCase() === lowerAlias);
          if (oldChat.messages.length === 0 && !existsInNew) {
            mergedList.push(oldChat);
          }
        });
        if (mergedList.length > 0 && !activeChatId) {
          // If we had a temporary chat, we might want to prioritize keeping the active selection
          const currentActiveExists = mergedList.some(c => c.id === activeChatId);
          if (!currentActiveExists) {
            setActiveChatId(mergedList[0].id);
          }
        }
        return mergedList;
      });
    } catch (err) {
      console.error("Error syncing chat channels.");
    }
  };

  // Sync profile details (like balance)
  const refreshUserBalance = async () => {
    if (!user || !user.username) return;
    try {
      const res = await fetch(`${API_BASE}/auth/profile/${user.username}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUser(prev => ({
        ...prev,
        profileData: data
      }));
    } catch (err) {
      console.error("Error refreshing profile balance.");
    }
  };

  const fetchTransactions = async () => {
    if (!user || !user.username) return;
    try {
      const res = await fetch(`${API_BASE}/transactions/${user.username}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTransactionHistory(data);
    } catch (err) {
      console.error("Error syncing transactions.");
    }
  };

  // DDoS Shield browser check timer effect
  useEffect(() => {
    if (!isDdosVerifying || verificationStage !== 'js_check') return;

    const logsTemplates = [
      "Evaluando entorno de ejecución JavaScript (JS Engine)... OK",
      "Comprobando soporte de DOM y Web Workers... OK",
      "Ejecutando script de prueba anti-inyección... OK",
      "Comprobando soporte de Criptografía de Sesión... OK",
      "Entorno de JS verificado con éxito. Acceso concedido."
    ];

    let currentProgress = 0;
    let logIndex = 0;

    const interval = setInterval(() => {
      currentProgress += 5;
      if (currentProgress > 100) currentProgress = 100;
      setDdosProgress(currentProgress);

      if (currentProgress % 20 === 0 && logIndex < logsTemplates.length) {
        setDdosLogs(prev => [...prev, logsTemplates[logIndex]]);
        logIndex++;
      }

      if (currentProgress === 100) {
        clearInterval(interval);
        setTimeout(() => {
          setUser(pendingUser);
          setIsDdosVerifying(false);
          setPendingUser(null);
          setCurrentRoute('marketplace');
        }, 800);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [isDdosVerifying, verificationStage, pendingUser]);

  // Initial and Polling load
  useEffect(() => {
    fetchProducts();
    if (user && user.username) {
      fetchOrders();
      fetchChats();
      refreshUserBalance();
      fetchTransactions();
    }

    // Poll server every 3.5 seconds to keep tabs in-sync
    const interval = setInterval(() => {
      fetchProducts();
      if (user && user.username) {
        fetchOrders();
        fetchChats();
        refreshUserBalance();
        fetchTransactions();
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [user]);

  // Auth handler
  const handleAuthSuccess = (authenticatedUser) => {
    setPendingUser(authenticatedUser);
    setIsDdosVerifying(true);
    setVerificationStage('challenge');
    setDdosError('');
    // Shuffle emojis for the challenge
    const emojis = ['🚗', '🍎', '🐱', '🍌', '💿', '💾', '💡', '🔒'];
    const shuffled = [ '🐙', ...emojis.sort(() => 0.5 - Math.random()).slice(0, 2) ].sort(() => 0.5 - Math.random());
    setDdosEmojis(shuffled);
    setDdosProgress(0);
    setDdosLogs([
      "Iniciando Kraken DDoS Shield v2.1...",
      "Resolviendo dirección IP del cliente... OK",
      "Analizando cabeceras HTTP del agente... OK"
    ]);
  };

  const handleDdosChallengeClick = (emoji) => {
    if (emoji === '🐙') {
      setDdosError('');
      setVerificationStage('js_check');
      setDdosProgress(0);
      setDdosLogs([
        "Desafío de Humano Completado: Kraken Identificado... OK",
        "Iniciando Kraken JavaScript Security Checker...",
        "Comprobando soporte del motor JS del navegador... OK"
      ]);
    } else {
      setDdosError("Fallo de Firma de Humano: Has hecho clic en el objeto incorrecto. Inténtelo de nuevo.");
      // Reshuffle emojis
      const emojis = ['🚗', '🍎', '🐱', '🍌', '💿', '💾', '💡', '🔒'];
      const shuffled = [ '🐙', ...emojis.sort(() => 0.5 - Math.random()).slice(0, 2) ].sort(() => 0.5 - Math.random());
      setDdosEmojis(shuffled);
    }
  };

  const handleLogout = () => {
    if (window.confirm("¿Seguro que deseas salir del sistema Kraken?")) {
      setUser(null);
      setOrders([]);
      setChatHistory([]);
      setSelectedProduct(null);
      setCheckoutProduct(null);
      localStorage.removeItem('kraken_session_user');
    }
  };

  const addTransaction = async (tx) => {
    if (!user || !user.username) return;
    try {
      const res = await fetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          ...tx
        })
      });
      if (!res.ok) throw new Error();
      fetchTransactions(); // refresh
    } catch (err) {
      console.error("Error logging transaction to server.");
    }
  };

  // Chat initiation
  const handleMessageSeller = (product) => {
    setSelectedProduct(null);
    const sellerName = product.seller || 'Desconocido';
    const chatId = `chat_${sellerName.toLowerCase()}`;
    
    // Check if chat exists locally
    const exists = chatHistory.some(c => c.id === chatId);
    if (!exists) {
      // Add a client-side temporary chat entry until a message is sent to server
      const tempChat = {
        id: chatId,
        sellerAlias: product.seller,
        productTitle: product.title,
        messages: []
      };
      setChatHistory(prev => [tempChat, ...prev]);
    }

    setActiveChatId(chatId);
    setCurrentRoute('chats');
  };

  const handleBuyNow = (product) => {
    setSelectedProduct(null);
    setCheckoutProduct(product);
  };

  // Send message API POST
  const handleSendMessage = async (chatId, recipient, text) => {
    const activeConv = chatHistory.find(c => c.id === chatId);
    const productTitle = activeConv ? activeConv.productTitle : '';

    try {
      const res = await fetch(`${API_BASE}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: user.username,
          to: recipient,
          text: text,
          productTitle: productTitle
        })
      });

      if (!res.ok) throw new Error();
      fetchChats(); // refresh messages
    } catch (err) {
      alert("Error al enviar mensaje al servidor.");
    }
  };

  // Render components
  const renderActiveView = () => {
    if (!user || !user.username || !user.profileData) {
      return (
        <LoginRegister 
          API_BASE={API_BASE} 
          onAuthSuccess={handleAuthSuccess} 
        />
      );
    }

    switch (currentRoute) {
      case 'marketplace':
        return (
          <div>
            {selectedProduct ? (
              <ProductDetail
                product={selectedProduct}
                currentUser={user}
                API_BASE={API_BASE}
                onClose={() => setSelectedProduct(null)}
                onMessageSeller={handleMessageSeller}
                onBuyNow={handleBuyNow}
                onBidPlaced={fetchProducts}
              />
            ) : (
              <Marketplace
                products={products}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onProductClick={setSelectedProduct}
                setCurrentRoute={setCurrentRoute}
              />
            )}
          </div>
        );
      case 'chats':
        return (
          <ChatCenter
            chatHistory={chatHistory}
            activeChatId={activeChatId}
            setActiveChatId={setActiveChatId}
            sendMessage={handleSendMessage}
            user={user}
            onLocalNudge={() => {
              setIsAppShaking(true);
              setTimeout(() => setIsAppShaking(false), 800);
            }}
            playMsnNudgeSound={playMsnNudgeSound}
          />
        );
      case 'profile':
        return (
          <MyProfile
            API_BASE={API_BASE}
            user={user}
            setUser={setUser}
            transactionHistory={transactionHistory}
            addTransaction={addTransaction}
            refreshUserBalance={refreshUserBalance}
            orders={orders}
          />
        );
      case 'escrow':
        return (
          <EscrowOrders
            orders={orders}
            user={user}
            API_BASE={API_BASE}
            onOrderUpdated={fetchOrders}
          />
        );
      case 'store':
        return (
          <MyStore
            user={user}
            products={products}
            API_BASE={API_BASE}
            onListingCreated={fetchProducts}
            onListingDeleted={fetchProducts}
          />
        );
      case 'forum':
        return (
          <ForumBoard 
            API_BASE={API_BASE} 
            user={user} 
          />
        );
      case 'network':
        return <NetworkHub />;
      default:
        return (
          <Marketplace 
            products={products} 
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onProductClick={setSelectedProduct}
            setCurrentRoute={setCurrentRoute}
          />
        );
    }
  };

  if (isDdosVerifying) {
    return (
      <div style={{ backgroundColor: 'var(--bg-page)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'var(--font-sans)' }}>
        
        {/* Retro noscript block warning for demonstration */}
        <noscript>
          <div style={{
            maxWidth: '400px',
            backgroundColor: '#ffe3e3',
            border: '2px solid #cc0000',
            color: '#cc0000',
            padding: '16px',
            marginBottom: '20px',
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            fontWeight: 'bold',
            textAlign: 'center',
            boxShadow: '0px 4px 10px rgba(0,0,0,0.15)'
          }}>
            [!] ERROR CRÍTICO: JavaScript está DESACTIVADO. 
            El motor de seguridad Kraken requiere soporte JavaScript activo para validar la integridad de la sesión y ejecutar la prueba de trabajo.
          </div>
        </noscript>

        <div className="cgi-form-box" style={{ width: '400px', backgroundColor: '#ffffff', border: '1px solid #999', padding: '20px', textAlign: 'center', boxShadow: '0px 4px 10px rgba(0,0,0,0.15)' }}>
          <div className="cgi-header" style={{ borderBottom: '2px solid #000080', paddingBottom: '6px', color: '#000080', fontWeight: 'bold', fontSize: '13px', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
            {verificationStage === 'challenge' ? 'Kraken DDoS Shield v2.1 - Proof of Human' : 'Kraken JavaScript Security Checker'}
          </div>
          <div style={{ padding: '20px 0' }}>
            {verificationStage === 'challenge' ? (
              <div>
                <span style={{ fontSize: '32px', display: 'inline-block', marginBottom: '8px' }}>🛡️</span>
                <p style={{ fontWeight: 'bold', fontSize: '12px', marginTop: '12px' }}>
                  Firma de Humano Requerida
                </p>
                <p style={{ fontSize: '11px', color: '#666', marginTop: '4px', marginBottom: '16px' }}>
                  Haz clic sobre el Kraken (🐙) para demostrar que no eres parte de una botnet DDoS.
                </p>

                {ddosError && (
                  <div style={{ 
                    padding: '6px', 
                    backgroundColor: '#ffe3e3', 
                    border: '1px solid #cc0000', 
                    color: '#cc0000', 
                    fontSize: '10px',
                    marginBottom: '12px',
                    textAlign: 'left'
                  }}>
                    {ddosError}
                  </div>
                )}

                {/* Shuffled Emojis Buttons Grid */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '16px' }}>
                  {ddosEmojis.map((emoji, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleDdosChallengeClick(emoji)}
                      className="cgi-btn"
                      style={{ 
                        fontSize: '28px', 
                        width: '60px', 
                        height: '60px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <span style={{ fontSize: '32px', display: 'inline-block', marginBottom: '8px' }}>⚙️</span>
                <p style={{ fontWeight: 'bold', fontSize: '12px', marginTop: '12px' }}>
                  Verificando soporte y compatibilidad JavaScript...
                </p>
                <p style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                  Espere un momento. Evaluando entorno de ejecución seguro.
                </p>
                
                {/* Progress Bar */}
                <div style={{ 
                  border: '1px solid #7f9db9', 
                  height: '16px', 
                  margin: '16px 0', 
                  backgroundColor: '#f0f0f0', 
                  position: 'relative',
                  textAlign: 'left'
                }}>
                  <div style={{ 
                    width: `${ddosProgress}%`, 
                    height: '100%', 
                    backgroundColor: '#000080', 
                    transition: 'width 0.1s linear'
                  }}></div>
                </div>

                {/* Scrolling Logs */}
                <div style={{ 
                  border: '1px solid #ccc', 
                  backgroundColor: '#fdfdfd', 
                  padding: '8px', 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '10px', 
                  textAlign: 'left', 
                  color: '#333',
                  height: '80px',
                  overflowY: 'auto'
                }}>
                  {ddosLogs.map((log, idx) => (
                    <div key={idx} style={{ marginBottom: '2px' }}>&gt; {log}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ fontSize: '10px', color: '#888', borderTop: '1px dotted #ccc', paddingTop: '10px' }}>
            Kraken DDoS Shield protege la integridad comercial del nodo.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`forum-wrapper ${isAppShaking ? 'msn-window-shake' : ''}`}>
      {/* Top Yellow Navbar */}
      <Sidebar 
        currentRoute={(user && user.username && user.profileData) ? currentRoute : 'auth'} 
        setCurrentRoute={setCurrentRoute} 
        user={user}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main>
        
        {/* Offline notice */}
        {isServerOffline && (
          <div style={{ 
            padding: '8px 16px', 
            marginBottom: '16px', 
            backgroundColor: '#fff0f0', 
            border: '1px solid #cc0000',
            color: '#cc0000',
            fontSize: '11px',
            textAlign: 'center'
          }}>
            <b>Aviso de Red:</b> El servidor local Express en el puerto 8080 no responde. Por favor, inicia el backend ejecutando <code>npm start</code> en la carpeta raíz.
          </div>
        )}

        {renderActiveView()}
      </main>

      {/* CGI Checkout wizard modal */}
      {checkoutProduct && (
        <CheckoutModal
          product={checkoutProduct}
          onClose={() => setCheckoutProduct(null)}
          user={user}
          setUser={setUser}
          API_BASE={API_BASE}
          addTransaction={addTransaction}
          onOrderCompleted={() => {
            fetchOrders();
            setCurrentRoute('escrow');
          }}
        />
      )}

      {/* Forum Footer */}
      <footer className="forum-footer">
        Derechos Reservados © 2026 KrakenMarket Inc. El uso de este sitio web implica la aceptación de los Términos de Servicio y Políticas de Escrow.
      </footer>
    </div>
  );
}

export default App;
