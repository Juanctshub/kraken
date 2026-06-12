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
          <div className="forum-banner-logo" onClick={() => setCurrentRoute('marketplace')}>
            KrakenMarket
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
