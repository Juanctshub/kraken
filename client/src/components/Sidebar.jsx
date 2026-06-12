import React from 'react';

export default function Sidebar({ currentRoute, setCurrentRoute, user, onLogout }) {
  const menuItems = [
    { id: 'marketplace', label: 'Bazaar de Ofertas' },
    { id: 'store', label: 'Mi Tienda (Control Panel)' },
    { id: 'profile', label: 'Mi Perfil (Cuenta y Saldo)' },
    { id: 'chats', label: 'P2P MSN Messenger' },
    { id: 'forum', label: 'Foro phpBB' },
    { id: 'escrow', label: 'Registro de Compras' },
    { id: 'network', label: 'Diagnóstico de Red' },
  ];

  return (
    <div>
      {/* 2000s Yellow Mercado Libre header banner */}
      <header className="forum-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="forum-banner-logo" onClick={() => setCurrentRoute('marketplace')} style={{ display: 'flex', alignItems: 'center' }}>
            <svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px', filter: 'drop-shadow(1px 1px 0px #fff)' }}>
              {/* Head / Body of the Squid */}
              <path d="M50,5 C32,5 24,20 24,40 C24,53 29,62 36,67 C36,67 36,80 34,84 C33,86 35,89 38,88 L50,81 L62,88 C65,89 67,86 66,84 C64,80 64,67 64,67 C71,62 76,53 76,40 C76,20 68,5 50,5 Z" fill="#032b80"/>
              {/* Tentacles */}
              <path d="M22,70 C14,75 10,84 12,90 C13,93 17,91 16,88 C15,84 18,77 26,73" fill="#032b80"/>
              <path d="M30,73 C22,80 18,88 20,94 C21,97 25,95 24,92 C23,88 26,82 33,76" fill="#032b80"/>
              <path d="M78,70 C86,75 90,84 88,90 C87,93 83,91 84,88 C85,84 82,77 74,73" fill="#032b80"/>
              <path d="M70,73 C78,80 82,88 80,94 C79,97 75,95 76,92 C77,88 74,82 67,76" fill="#032b80"/>
              <path d="M44,81 C40,88 38,94 40,97 C41,99 44,98 44,96 C44,93 45,87 47,82" fill="#032b80"/>
              <path d="M56,81 C60,88 62,94 60,97 C59,99 56,98 56,96 C56,93 55,87 53,82" fill="#032b80"/>
              {/* Cute Y2K white eyes */}
              <circle cx="40" cy="38" r="7" fill="#ffffff" />
              <circle cx="40" cy="38" r="3.5" fill="#000000" />
              <circle cx="40" cy="36" r="1.5" fill="#ffffff" />
              <circle cx="60" cy="38" r="7" fill="#ffffff" />
              <circle cx="60" cy="38" r="3.5" fill="#000000" />
              <circle cx="60" cy="36" r="1.5" fill="#ffffff" />
            </svg>
            <span>Kraken Marketplace</span>
          </div>
          <div className="forum-banner-subtitle">
            El bazaar descentralizado más libre de la web · Años 2000s
          </div>
        </div>

        {/* User Session Quick status */}
        <div style={{ fontSize: '11px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          {user && user.username && user.profileData ? (
            <>
              <span>Bienvenido, <b>{user.username}</b> {user.profileData.avatar || '👤'}</span>
              <span>Saldo: <b style={{ color: '#032b80', fontFamily: 'var(--font-mono)' }}>${(user.profileData.balance || 0).toFixed(2)} USD</b></span>
              <button 
                onClick={onLogout} 
                className="cgi-btn" 
                style={{ padding: '2px 8px', fontSize: '9px', fontWeight: 'normal' }}
              >
                [ Salir ]
              </button>
            </>
          ) : (
            <span>Invitado sin sesión</span>
          )}
        </div>
      </header>

      {/* Ticker / Speed Telemetry bar */}
      <div className="dialup-indicator">
        <div>
          <span style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            backgroundColor: '#00cc00', 
            display: 'inline-block',
            marginRight: '6px'
          }}></span>
          <span><b>Servidor Kraken:</b> Conectado · Protocolo consensus-dht v1.0</span>
        </div>
        <div>
          <span>Velocidad: <b>56,000 bps (Dial-Up)</b></span>
        </div>
      </div>

      {/* Tabs Menu Navigation Bar */}
      {user && (
        <nav className="forum-navbar">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentRoute(item.id)}
              className={`forum-nav-btn ${currentRoute === item.id ? 'active' : ''}`}
            >
              {item.label.toUpperCase()}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
