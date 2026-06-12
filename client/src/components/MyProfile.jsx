import React, { useState, useEffect } from 'react';
import { PlusCircle, Shield, Key, Star, ShieldAlert, CheckCircle2, RefreshCw, QrCode, ArrowUpRight, ArrowDownLeft, Lock } from 'lucide-react';

export default function MyProfile({ 
  API_BASE, 
  user, 
  setUser, 
  transactionHistory, 
  addTransaction, 
  refreshUserBalance,
  orders = []
}) {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'security', 'reputation'
  
  // Dynamic reputation states
  const [reputationData, setReputationData] = useState({
    averageRating: 'Sin puntuación',
    reviewsCount: 0,
    reviews: []
  });

  useEffect(() => {
    if (!API_BASE || !user.username) return;
    
    fetch(`${API_BASE}/reviews/${user.username}`)
      .then(res => res.json())
      .then(data => {
        setReputationData(data);
      })
      .catch(() => {
        setReputationData({
          averageRating: 'Sin puntuación',
          reviewsCount: 0,
          reviews: []
        });
      });
  }, [activeTab, user.username, API_BASE]);

  // Profile settings state
  const [bio, setBio] = useState(user.profileData.bio || '');
  const [location, setLocation] = useState(user.profileData.location || '');
  const [storeName, setStoreName] = useState(user.profileData.storeName || '');
  const [avatar, setAvatar] = useState(user.profileData.avatar || '👤');
  const [isSaving, setIsSaving] = useState(false);

  // Password settings state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // PIN & PGP settings state
  const [escrowPin, setEscrowPin] = useState('1234');
  const [pgpKey, setPgpKey] = useState('-----BEGIN PGP PUBLIC KEY BLOCK-----\nVersion: GnuPG v2\n\nmQENBF7z23kBCADp1Vp5k6W6kQd2H...\n-----END PGP PUBLIC KEY BLOCK-----');

  // Binance-style Deposit Wizard state
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositCoin, setDepositCoin] = useState('USDT');
  const [depositAmount, setDepositAmount] = useState('100');
  const [depositTxHash, setDepositTxHash] = useState('');
  const [depositStep, setDepositStep] = useState(1); // 1 = details form, 2 = confirmations loader, 3 = success
  const [depositConfirmations, setDepositConfirmations] = useState(0);
  const [isDepositing, setIsDepositing] = useState(false);

  // Withdrawal verification state
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const avatarsList = ['👤', '👨', '👩', '🤠', '🦊', '🐱', '🐼', '🕶️', '👾', '🚀'];

  const completedSalesCount = (orders || []).filter(o => 
    user && user.username && o.seller && o.seller.toLowerCase() === user.username.toLowerCase() && 
    o.status === 'completed'
  ).length;

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch(`${API_BASE}/auth/profile/${user.username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio, location, storeName, avatar })
      });
      const data = await res.json();

      if (!res.ok) throw new Error();

      setUser(prev => ({
        ...prev,
        profileData: data.profileData
      }));

      alert("¡Perfil actualizado con éxito en el servidor!");
    } catch (err) {
      alert("Error al actualizar perfil en el servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert("La nueva contraseña y la confirmación no coinciden.");
      return;
    }

    setIsSavingPassword(true);

    try {
      const res = await fetch(`${API_BASE}/auth/profile/${user.username}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Error al actualizar la contraseña.");
      }

      alert("¡Contraseña cambiada con éxito en el servidor!");
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      alert(err.message || "Error al cambiar la contraseña.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleSavePgp = (e) => {
    e.preventDefault();
    alert("¡Firma criptográfica PGP guardada en la memoria local del cliente!");
  };

  const handleSavePin = (e) => {
    e.preventDefault();
    alert(`¡PIN de Escrow actualizado con éxito! Nuevo PIN: ${escrowPin}`);
  };

  // Binance-style Deposit verification cycle
  const handleDepositSubmit = (e) => {
    e.preventDefault();
    if (!depositTxHash.trim() || isNaN(parseFloat(depositAmount)) || parseFloat(depositAmount) <= 0) {
      alert("Por favor, introduce un hash de transacción y un monto de depósito válido.");
      return;
    }

    setIsDepositing(true);
    setDepositStep(2);
    setDepositConfirmations(0);

    let currentConf = 0;
    const interval = setInterval(() => {
      currentConf += 1;
      setDepositConfirmations(currentConf);

      if (currentConf === 3) {
        clearInterval(interval);
        completeDeposit();
      }
    }, 1500); // 1.5 seconds per confirmation
  };

  const completeDeposit = async () => {
    const amount = parseFloat(depositAmount);
    const newBalance = user.profileData.balance + amount;

    try {
      const res = await fetch(`${API_BASE}/auth/profile/${user.username}/balance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: newBalance })
      });
      const data = await res.json();

      if (!res.ok) throw new Error();

      // Update parent state
      setUser(prev => ({
        ...prev,
        profileData: {
          ...prev.profileData,
          balance: data.balance
        }
      }));

      // Log transaction
      addTransaction({
        type: 'deposit',
        coin: depositCoin,
        amount: amount,
        usdValue: amount,
        txHash: depositTxHash,
        timestamp: new Date().toISOString()
      });

      setDepositStep(3);
      setIsDepositing(false);
      refreshUserBalance();
    } catch (err) {
      alert("Error al procesar el depósito en el servidor.");
      setIsDepositing(false);
      setDepositStep(1);
    }
  };

  // Withdrawal submit handler
  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Monto inválido.");
      return;
    }
    if (amount > user.profileData.balance) {
      alert("Saldo insuficiente para retirar.");
      return;
    }

    setIsWithdrawing(true);

    try {
      const newBalance = user.profileData.balance - amount;
      const res = await fetch(`${API_BASE}/auth/profile/${user.username}/balance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: newBalance })
      });
      const data = await res.json();

      if (!res.ok) throw new Error();

      setUser(prev => ({
        ...prev,
        profileData: {
          ...prev.profileData,
          balance: data.balance
        }
      }));

      // Log transaction
      addTransaction({
        type: 'withdrawal',
        coin: 'USDT',
        amount: amount,
        usdValue: amount,
        txHash: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        timestamp: new Date().toISOString()
      });

      alert(`¡Retiro procesado con éxito! Se han enviado $${amount} USD a la billetera cripto ${withdrawAddress}.`);
      setWithdrawOpen(false);
      setWithdrawAmount('');
      setWithdrawAddress('');
      refreshUserBalance();
    } catch (err) {
      alert("Error al procesar el retiro en el servidor.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const getCryptoAddress = (coin) => {
    if (coin === 'BTC') return '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy';
    if (coin === 'XMR') return '44AFFq5kSiGbU8bS1A2NvZVWc8c5F6eG356789abcdefghij';
    return '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
  };

  return (
    <div>
      <div className="view-header">
        <div>
          <h2 className="view-title">Mi Perfil y Panel de Control</h2>
          <p className="view-subtitle">Administra tu identidad comercial, información de contacto y monedero.</p>
        </div>
      </div>

      <div className="user-cp-container">
        {/* Left Submenu Navigation */}
        <aside className="user-cp-menu">
          <div className="user-cp-menu-header">Menú de Cuenta</div>
          <div 
            onClick={() => setActiveTab('profile')} 
            className={`user-cp-menu-item ${activeTab === 'profile' ? 'active' : ''}`}
          >
            👤 Editar Detalles de Perfil
          </div>
          <div 
            onClick={() => setActiveTab('security')} 
            className={`user-cp-menu-item ${activeTab === 'security' ? 'active' : ''}`}
          >
            ⚙️ Seguridad de Cuenta
          </div>
          <div 
            onClick={() => setActiveTab('reputation')} 
            className={`user-cp-menu-item ${activeTab === 'reputation' ? 'active' : ''}`}
          >
            📈 Reputación y Estrellas
          </div>
        </aside>

        {/* Workspace Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
          
          {/* TAB 1: EDIT PROFILE */}
          {activeTab === 'profile' && (
            <div className="cgi-form-box">
              <div className="cgi-header">
                <span>Editar Mi Perfil Comercial (user_profile.cgi)</span>
              </div>

              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ fontSize: '48px', width: '64px', height: '64px', border: '1px solid var(--border-grey)', backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {avatar}
                  </div>
                  
                  <div className="form-group" style={{ margin: 0, flexGrow: 1 }}>
                    <label>Selecciona tu Avatar Emoji</label>
                    <select value={avatar} onChange={e => setAvatar(e.target.value)}>
                      {avatarsList.map(av => <option key={av} value={av}>{av}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Nombre de Usuario (No se puede cambiar)</label>
                  <input 
                    type="text" 
                    value={user.username} 
                    disabled 
                    style={{ backgroundColor: '#eeeeee', color: '#555' }} 
                  />
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Ubicación / Ciudad comercial</label>
                    <input 
                      type="text" 
                      value={location} 
                      onChange={e => setLocation(e.target.value)} 
                      placeholder="e.g. Barcelona, España"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Nombre de Mi Tienda</label>
                    <input 
                      type="text" 
                      value={storeName} 
                      onChange={e => setStoreName(e.target.value)} 
                      placeholder="e.g. Bazar de Antigüedades"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Biografía / Presentación de Tienda</label>
                  <textarea 
                    value={bio} 
                    onChange={e => setBio(e.target.value)} 
                    rows="3" 
                    placeholder="Escribe detalles sobre envíos, garantías, quién eres..."
                  />
                </div>

                <button 
                  type="submit" 
                  className="cgi-btn cgi-btn-primary"
                  disabled={isSaving}
                  style={{ alignSelf: 'flex-start', marginTop: '6px' }}
                >
                  {isSaving ? 'Guardando...' : 'Guardar Cambios de Perfil'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: SECURITY CONFIG */}
          {activeTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* PASSWORD CHANGE */}
              <div className="cgi-form-box">
                <div className="cgi-header">
                  <span>Modificar Contraseña de Acceso (change_password.cgi)</span>
                </div>
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Contraseña Actual*</label>
                    <input 
                      type="password" 
                      value={currentPassword} 
                      onChange={e => setCurrentPassword(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Nueva Contraseña*</label>
                      <input 
                        type="password" 
                        value={newPassword} 
                        onChange={e => setNewPassword(e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Confirmar Nueva Contraseña*</label>
                      <input 
                        type="password" 
                        value={confirmPassword} 
                        onChange={e => setConfirmPassword(e.target.value)} 
                        required 
                      />
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="cgi-btn cgi-btn-primary" 
                    style={{ alignSelf: 'flex-start', marginTop: '6px' }}
                    disabled={isSavingPassword}
                  >
                    {isSavingPassword ? 'Cambiando...' : 'Actualizar Contraseña'}
                  </button>
                </form>
              </div>

              {/* ESCROW PIN */}
              <div className="cgi-form-box">
                <div className="cgi-header">
                  <span>PIN de Seguridad para Depósitos en Garantía (escrow_pin.cgi)</span>
                </div>
                <form onSubmit={handleSavePin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ fontSize: '11px', color: '#666', lineHeight: '1.4' }}>
                    Este PIN de 4 dígitos es requerido por el contrato multisig del nodo Kraken para liberar fondos y autorizar transacciones de escrow.
                  </p>
                  <div className="form-group" style={{ marginBottom: 0, maxWidth: '200px' }}>
                    <label>PIN de Escrow (4 números)</label>
                    <input 
                      type="password" 
                      maxLength={4} 
                      value={escrowPin} 
                      onChange={e => setEscrowPin(e.target.value.replace(/\D/g, ''))} 
                    />
                  </div>
                  <button type="submit" className="cgi-btn" style={{ alignSelf: 'flex-start' }}>
                    Establecer PIN
                  </button>
                </form>
              </div>

              {/* PGP KEY CONFIG */}
              <div className="cgi-form-box">
                <div className="cgi-header">
                  <span>Firma Digital Criptográfica PGP (pgp_keys.cgi)</span>
                </div>
                <form onSubmit={handleSavePgp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ fontSize: '11px', color: '#666', lineHeight: '1.4' }}>
                    Guarda tu clave pública PGP para permitir que otros compradores se comuniquen contigo utilizando cifrado de extremo a extremo.
                  </p>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Clave Pública PGP</label>
                    <textarea 
                      rows="6" 
                      value={pgpKey} 
                      onChange={e => setPgpKey(e.target.value)} 
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }} 
                    />
                  </div>
                  <button type="submit" className="cgi-btn" style={{ alignSelf: 'flex-start' }}>
                    Guardar Clave PGP
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: REPUTATION & STARS */}
          {activeTab === 'reputation' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="cgi-form-box">
                <div className="cgi-header">
                  <span>Historial de Reputación y Garantías (reputation_ledger.cgi)</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', paddingBottom: '16px', borderBottom: '1px dotted #ccc' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: '#666', fontWeight: 'bold' }}>NIVEL DE REPUTACIÓN:</span>
                    <h3 style={{ fontSize: '20px', color: '#b8860b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <Star size={20} fill="#b8860b" /> {reputationData.averageRating === 'Sin puntuación' ? 'Sin puntuación' : `${reputationData.averageRating} / 5.0`}
                    </h3>
                    <p style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>
                      Puntaje acumulado por compradores tras liberar depósitos.
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: '#666', fontWeight: 'bold' }}>ESTADO DE VENDEDOR:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success-color)', fontWeight: 'bold', fontSize: '13px', marginTop: '6px' }}>
                      <CheckCircle2 size={16} /> Pionero Kraken (Verificado)
                    </div>
                    <p style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>
                      Miembro activo con PIN de escrow configurado.
                    </p>
                  </div>
                </div>

                {/* Scorecard table */}
                <div style={{ marginTop: '16px' }}>
                  <h4 style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' }}>Métricas Comerciales del Nodo</h4>
                  <table className="forum-table" style={{ fontSize: '11px', margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Métrica de Confianza</th>
                        <th>Valor</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Ventas Totales Completadas en Escrow</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{completedSalesCount}</td>
                        <td style={{ color: completedSalesCount > 10 ? 'var(--success-color)' : '#b8860b', fontWeight: 'bold' }}>
                          {completedSalesCount > 10 ? 'VERIFICADO (ETAPA LIBRE)' : 'ETAPA DE VERIFICACIÓN'}
                        </td>
                      </tr>
                      <tr>
                        <td>Disputas del Escrow Arbitradas a Favor</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>2</td>
                        <td style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>LIMPIO</td>
                      </tr>
                      <tr>
                        <td>Disputas Perdidas</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>0</td>
                        <td style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>EXCELENTE</td>
                      </tr>
                      <tr>
                        <td>Tiempo promedio de envío registrado</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>14 horas</td>
                        <td style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>RÁPIDO</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Reviews List */}
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' }}>Últimas Reseñas del Libro de Firmas</h4>
                  {reputationData.reviews.length === 0 ? (
                    <p style={{ fontSize: '11px', color: '#888', fontStyle: 'italic' }}>
                      No se han encontrado valoraciones de escrow para este usuario en el libro de firmas todavía.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {reputationData.reviews.slice().reverse().map((rev, idx) => (
                        <div key={idx} style={{ padding: '8px', border: '1px solid #eee', backgroundColor: '#fafafa', fontSize: '11px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '10px', marginBottom: '4px' }}>
                            <span>Firmado por: <b>{rev.fromUser}</b></span>
                            <span style={{ color: '#b8860b' }}>
                              {"⭐".repeat(rev.rating)} ({rev.rating}/5)
                            </span>
                          </div>
                          <p style={{ color: '#333' }}>"{rev.comment}"</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* BALANCE & WALLET (ALWAYS RENDERED ON BOTTOM OF PROFILE OR IN SEPARATE AREA) */}
          <div className="cgi-form-box">
            <div className="cgi-header">
              <span>Saldo en Mi Billetera</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px', alignItems: 'center', borderBottom: '1px dotted var(--border-grey)', paddingBottom: '14px', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>SALDO DISPONIBLE EN CUENTA:</span>
                <h3 style={{ fontSize: '28px', color: 'var(--price-color)', fontFamily: 'var(--font-mono)', fontWeight: 'bold', marginTop: '2px' }}>
                  ${user.profileData.balance.toFixed(2)} USD
                </h3>
                <span style={{ fontSize: '10px', color: '#888' }}>
                  Aproximadamente {(user.profileData.balance / 65000).toFixed(6)} BTC / {(user.profileData.balance / 140).toFixed(4)} XMR
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => {
                    setDepositOpen(true);
                    setDepositStep(1);
                    setDepositTxHash('');
                  }} 
                  className="cgi-btn cgi-btn-primary" 
                  style={{ flexGrow: 1, padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '11px' }}
                >
                  <ArrowDownLeft size={14} /> Depositar Fondos
                </button>
                <button 
                  onClick={() => setWithdrawOpen(true)} 
                  className="cgi-btn" 
                  style={{ flexGrow: 1, padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '11px' }}
                >
                  <ArrowUpRight size={14} /> Retirar Saldo
                </button>
              </div>
            </div>

            <h4 style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' }}>Historial de Transacciones Locales ({transactionHistory.length})</h4>
            {transactionHistory.length === 0 ? (
              <p style={{ color: '#888', fontStyle: 'italic', fontSize: '11px' }}>No hay registros de transacciones para este usuario.</p>
            ) : (
              <table className="forum-table" style={{ fontSize: '11px', margin: 0 }}>
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>Hash de Transacción</th>
                    <th>Monto</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionHistory.slice().reverse().map((tx, idx) => (
                    <tr key={idx}>
                      <td>
                        <span style={{ 
                          color: tx.type === 'deposit' ? 'var(--success-color)' : 
                                 tx.type === 'withdrawal' ? '#8a6d3b' : 'var(--price-color)',
                          fontWeight: 'bold'
                        }}>
                          {tx.type === 'deposit' ? 'DEPOSIT' : 
                           tx.type === 'withdrawal' ? 'WITHDRAWAL' : 'ESCROW LOCK'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#666' }}>
                        {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-10)}
                      </td>
                      <td style={{ fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                        ${tx.amount.toFixed(2)} USD
                      </td>
                      <td style={{ color: '#888' }}>
                        {new Date(tx.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* BINANCE-STYLE DEPOSIT GATEWAY MODAL */}
      {depositOpen && (
        <div className="modal-overlay">
          <div className="cgi-form-box" style={{ width: '460px', backgroundColor: '#fff', color: '#333' }}>
            <div className="cgi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Pasarela de Depósito Crypto - Binance Mock Gateway</span>
              <a onClick={() => setDepositOpen(false)} style={{ color: '#cc0000', cursor: 'pointer', fontSize: '11px' }}>[CERRAR]</a>
            </div>

            {depositStep === 1 && (
              <form onSubmit={handleDepositSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold' }}>1. Selecciona Criptomoneda:</label>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    {['USDT', 'BTC', 'XMR'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setDepositCoin(c)}
                        className="cgi-btn"
                        style={{
                          flexGrow: 1,
                          backgroundColor: depositCoin === c ? '#f0f0f0' : '#fff',
                          fontWeight: depositCoin === c ? 'bold' : 'normal',
                          borderColor: depositCoin === c ? '#000080' : '#ccc'
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px', alignItems: 'center', border: '1px solid #ddd', padding: '10px', backgroundColor: '#fafafa' }}>
                  <div style={{ border: '1px solid #ccc', backgroundColor: '#fff', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* Simulated pixel QR code */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 12px)', gap: '1px' }}>
                      {Array.from({ length: 25 }).map((_, i) => (
                        <div
                          key={i}
                          style={{
                            width: '12px',
                            height: '12px',
                            backgroundColor: (i * 7 + 3) % 5 === 0 || i % 4 === 0 || i === 0 || i === 4 || i === 20 || i === 24 ? '#000' : '#fff'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: '10px', wordBreak: 'break-all' }}>
                    <span style={{ color: '#666', fontWeight: 'bold' }}>Dirección de Depósito ({depositCoin}):</span>
                    <div style={{ fontFamily: 'var(--font-mono)', marginTop: '2px', backgroundColor: '#eee', padding: '4px', fontSize: '9px', border: '1px solid #ccc' }}>
                      {getCryptoAddress(depositCoin)}
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Monto a Depositar (USD)*</label>
                    <input 
                      type="number" 
                      value={depositAmount} 
                      onChange={e => setDepositAmount(e.target.value)} 
                      placeholder="e.g. 100" 
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Equivalente en Cripto:</label>
                    <input 
                      type="text" 
                      value={
                        depositCoin === 'BTC' ? (parseFloat(depositAmount || 0) / 65000).toFixed(6) : 
                        depositCoin === 'XMR' ? (parseFloat(depositAmount || 0) / 140).toFixed(4) : 
                        parseFloat(depositAmount || 0).toFixed(2)
                      } 
                      disabled 
                      style={{ backgroundColor: '#eee' }} 
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Hash de Transacción / TxID de Blockchain*</label>
                  <input 
                    type="text" 
                    value={depositTxHash} 
                    onChange={e => setDepositTxHash(e.target.value)} 
                    placeholder="Introduce el hash TxID (ej. 0x8a1f...)"
                    required
                  />
                  <span style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>
                    Pega el ID de transacción simulado para iniciar la confirmación en el explorador.
                  </span>
                </div>

                <button type="submit" className="cgi-btn cgi-btn-primary" style={{ padding: '8px' }}>
                  Confirmar Transferencia
                </button>
              </form>
            )}

            {depositStep === 2 && (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <RefreshCw size={36} className="animate-spin" style={{ display: 'inline-block', color: '#000080', marginBottom: '16px' }} />
                <h4 style={{ fontSize: '13px', fontWeight: 'bold' }}>Esperando Confirmaciones de Red...</h4>
                <p style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                  Verificando transacciones en el libro mayor de {depositCoin}.
                </p>
                
                {/* Confirmations tracker */}
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                  <div style={{ fontSize: '24px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: '#b8860b' }}>
                    {depositConfirmations} / 3
                  </div>
                  <div style={{ width: '200px', height: '12px', border: '1px solid #7f9db9', backgroundColor: '#f0f0f0' }}>
                    <div style={{ width: `${(depositConfirmations / 3) * 100}%`, height: '100%', backgroundColor: '#000080', transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: '10px', color: '#888', fontFamily: 'var(--font-mono)' }}>
                    TxID: {depositTxHash.slice(0, 16)}...
                  </span>
                </div>
              </div>
            )}

            {depositStep === 3 && (
              <div style={{ textAlign: 'center', padding: '30px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '40px' }}>🎉</span>
                <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--success-color)' }}>
                  ¡DEPÓSITO CONFIRMADO Y RECONOCIDO!
                </h4>
                <p style={{ fontSize: '11px', color: '#333', lineHeight: '1.4', maxWidth: '340px' }}>
                  La blockchain ha retornado 3 confirmaciones válidas para el TxID provisto. Se han acreditado <b>${parseFloat(depositAmount).toFixed(2)} USD</b> a tu saldo Kraken.
                </p>
                <button onClick={() => setDepositOpen(false)} className="cgi-btn cgi-btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                  Volver a Mi Billetera
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WITHDRAWAL PROCESS / LOCKED VERIFICATION STAGE MODAL */}
      {withdrawOpen && (
        <div className="modal-overlay">
          <div className="cgi-form-box" style={{ width: '460px', backgroundColor: '#fff', color: '#333' }}>
            <div className="cgi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Retirar Fondos del Nodo - withdrawal_engine.cgi</span>
              <a onClick={() => setWithdrawOpen(false)} style={{ color: '#cc0000', cursor: 'pointer', fontSize: '11px' }}>[CERRAR]</a>
            </div>

            {completedSalesCount <= 10 ? (
              // LOCKED STAGE: SALES COUNTER LESS THAN 10
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
                <div style={{ display: 'flex', gap: '10px', backgroundColor: '#fff0f0', border: '1px solid #cc0000', padding: '12px', color: '#cc0000' }}>
                  <ShieldAlert size={28} style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
                    <b style={{ textTransform: 'uppercase' }}>Etapa de Verificación Activa (Retiro Bloqueado)</b>
                    <p style={{ marginTop: '4px' }}>
                      De acuerdo con la directiva comercial del bazar Kraken, las cuentas de vendedor deben completar exitosamente <b>más de 10 ventas en escrow</b> antes de habilitar el retiro a wallets externas.
                    </p>
                  </div>
                </div>

                <div style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#fafafa', fontSize: '11px' }}>
                  <h4 style={{ fontWeight: 'bold', marginBottom: '6px' }}>Tu Progreso de Verificación:</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#666', marginBottom: '4px' }}>
                    <span>Ventas Completadas con Éxito:</span>
                    <span><b>{completedSalesCount} / 10</b></span>
                  </div>
                  {/* Progress Bar */}
                  <div style={{ width: '100%', height: '14px', border: '1px solid #7f9db9', backgroundColor: '#f0f0f0' }}>
                    <div style={{ width: `${Math.min((completedSalesCount / 10) * 100, 100)}%`, height: '100%', backgroundColor: '#cc0000' }} />
                  </div>
                  <div style={{ fontSize: '9px', color: '#888', marginTop: '8px', lineHeight: '1.3' }}>
                    *Esta política de control de riesgos previene que usuarios maliciosos cobren depósitos simulados sin realizar envíos físicos reales.
                  </div>
                </div>

                <button onClick={() => setWithdrawOpen(false)} className="cgi-btn" style={{ width: '100%' }}>
                  Entendido
                </button>
              </div>
            ) : (
              // ALLOW WITHDRAWAL FORM
              <form onSubmit={handleWithdrawSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                <div style={{ display: 'flex', gap: '8px', backgroundColor: '#eef7fe', border: '1px solid #bce8f1', padding: '10px', color: '#31708f', fontSize: '11px' }}>
                  <Shield size={20} style={{ flexShrink: 0 }} />
                  <span>
                    <b>Nodo Verificado:</b> Has superado la etapa de validación de 10 ventas ({completedSalesCount} ventas). Retiro habilitado.
                  </span>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Monto de USDT a Retirar* (Saldo disponible: ${user.profileData.balance.toFixed(2)})</label>
                  <input 
                    type="number" 
                    step="0.01"
                    max={user.profileData.balance}
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    placeholder="e.g. 50"
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Dirección de destino Criptográfica (USDT - ERC20/TRC20)*</label>
                  <input 
                    type="text" 
                    value={withdrawAddress}
                    onChange={e => setWithdrawAddress(e.target.value)}
                    placeholder="e.g. 0x71C7656EC7ab88b098defB7..."
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  className="cgi-btn cgi-btn-primary" 
                  style={{ padding: '8px' }}
                  disabled={isWithdrawing || !withdrawAmount || !withdrawAddress}
                >
                  {isWithdrawing ? 'Procesando retiro...' : 'Enviar Solicitud de Retiro'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
