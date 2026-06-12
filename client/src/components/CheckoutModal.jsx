import React, { useState } from 'react';
import { X, Shield, Lock, Send, AlertTriangle } from 'lucide-react';

export default function CheckoutModal({ 
  product, 
  onClose, 
  user, 
  setUser,
  API_BASE,
  addTransaction, 
  onOrderCompleted 
}) {
  const [step, setStep] = useState(1);
  const [shippingAddress, setShippingAddress] = useState('');
  const [paymentCoin, setPaymentCoin] = useState('USDT');
  const [escrowMode, setEscrowMode] = useState('multisig');
  const [selectedModerator, setSelectedModerator] = useState('CryptoSherlock');
  const [isFunding, setIsFunding] = useState(false);

  const moderators = [
    { name: 'CryptoSherlock', fee: 1.0, did: 'did:key:z6MkgTspm...' },
    { name: 'OnionJudge', fee: 1.5, did: 'did:key:z6MkpX9uB...' }
  ];

  const handleFundEscrow = async () => {
    const usdPrice = parseFloat(product.price);
    const userBalance = user.profileData.balance;

    if (userBalance < usdPrice) {
      alert("Error: Saldo insuficiente. Reclama más saldo en 'Mi Perfil' primero.");
      return;
    }

    setIsFunding(true);
    
    // Calculate new balance
    const updatedBalance = userBalance - usdPrice;

    try {
      // 1. Update user balance on backend
      const balanceRes = await fetch(`${API_BASE}/auth/profile/${user.username}/balance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: updatedBalance })
      });

      if (!balanceRes.ok) throw new Error("Could not update user balance.");

      // 2. Create the order on backend
      const orderRes = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          productTitle: product.title,
          price: usdPrice,
          buyer: user.username,
          seller: product.seller,
          coin: paymentCoin,
          escrowMode: escrowMode,
          moderator: selectedModerator,
          shippingAddress: shippingAddress
        })
      });

      if (!orderRes.ok) throw new Error("Could not create backend order.");
      const orderData = await orderRes.json();

      // 3. Add ledger transaction
      addTransaction({
        type: 'escrow_lock',
        coin: paymentCoin,
        amount: usdPrice,
        usdValue: usdPrice,
        txHash: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        timestamp: new Date().toISOString()
      });

      // Update parent user state
      setUser(prev => ({
        ...prev,
        profileData: {
          ...prev.profileData,
          balance: updatedBalance
        }
      }));

      // Notify parent to refresh orders list
      onOrderCompleted();

      setIsFunding(false);
      setStep(4);
    } catch (err) {
      alert("Error al procesar la compra en el servidor: " + err.message);
      setIsFunding(false);
    }
  };

  const getCryptoAddress = (coin) => {
    if (coin === 'BTC') return '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy';
    return '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
  };

  return (
    <div className="modal-overlay">
      <div className="cgi-form-box" style={{ width: '500px', backgroundColor: '#fff', color: '#333' }}>
        
        {/* CGI Header */}
        <div className="cgi-header" style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center', margin: 0, paddingBottom: '8px', borderBottom: '2px solid #000080' }}>
          <span>Procesar Pago y Escrow - cgi-bin/checkout.cgi</span>
          <a onClick={onClose} style={{ fontSize: '11px', color: '#cc0000', cursor: 'pointer' }}>
            [CERRAR]
          </a>
        </div>

        {/* Steps display */}
        <div className="cgi-step-indicator" style={{ marginTop: '12px' }}>
          PASO {step} DE 4: {
            step === 1 ? 'DIRECCIÓN_DE_ENTREGA' : 
            step === 2 ? 'MÉTODO_DE_PAGO' : 
            step === 3 ? 'CONFIRMACIÓN_Y_DEPOSIT' : 'ORDEN_COMPLETA_EXITOSAMENTE'
          }
        </div>

        {/* STEP 1: SHIPPING ADDRESS */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Dirección física de entrega / Instrucciones*</label>
              <textarea 
                value={shippingAddress} 
                onChange={e => setShippingAddress(e.target.value)} 
                placeholder="Escribe el nombre del destinatario, calle, ciudad, código postal y país comercial..."
                rows="4"
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={onClose} className="cgi-btn">Cancelar</button>
              <button 
                disabled={!shippingAddress.trim()} 
                onClick={() => setStep(2)} 
                className="cgi-btn cgi-btn-primary"
              >
                Siguiente paso &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CHOOSE PAYMENT AND ESCROW */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            <div>
              <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Elige Moneda de Pago:</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                {['USDT', 'BTC', 'XMR', 'ETH'].map(coin => (
                  <label key={coin} className="cgi-btn" style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    padding: '6px 10px',
                    backgroundColor: paymentCoin === coin ? '#e6e6e6' : '#fff'
                  }}>
                    <input 
                      type="radio" 
                      name="coin" 
                      value={coin} 
                      checked={paymentCoin === coin}
                      onChange={() => setPaymentCoin(coin)} 
                    />
                    {coin}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Tipo de Depósito en Garantía:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', border: '1px solid #ddd', padding: '8px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="escrow" 
                    value="multisig" 
                    checked={escrowMode === 'multisig'}
                    onChange={() => setEscrowMode('multisig')} 
                  />
                  <div>
                    <b style={{ fontSize: '11px', color: '#032b80' }}>Depósito en Garantía 2-de-3 (Protegido)</b>
                    <p style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                      Los fondos se bloquean en el sistema. Si hay una disputa, un árbitro de la red decidirá el reembolso.
                    </p>
                  </div>
                </label>

                <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', border: '1px solid #ddd', padding: '8px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="escrow" 
                    value="direct" 
                    checked={escrowMode === 'direct'}
                    onChange={() => setEscrowMode('direct')} 
                  />
                  <div>
                    <b style={{ fontSize: '11px', color: 'var(--price-color)' }}>Pago Directo al Vendedor (Sin Protección)</b>
                    <p style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                      Los fondos se envían directamente al vendedor de inmediato. No se permiten reclamos.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {escrowMode === 'multisig' && (
              <div style={{ border: '1px dotted #ccc', padding: '8px', backgroundColor: '#fafafa' }}>
                <label>Árbitro de la comunidad asignado:</label>
                <select value={selectedModerator} onChange={e => setSelectedModerator(e.target.value)}>
                  {moderators.map(mod => (
                    <option key={mod.name} value={mod.name}>{mod.name} (Tasa: {mod.fee}%)</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(1)} className="cgi-btn">&larr; Atrás</button>
              <button onClick={() => setStep(3)} className="cgi-btn cgi-btn-primary">Paso de Pago &rarr;</button>
            </div>
          </div>
        )}

        {/* STEP 3: CONFIRM & FUND */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '10px', backgroundColor: '#fcf8e3', border: '1px solid #faebcc', color: '#8a6d3b', fontSize: '11px' }}>
              Confirmas que vas a depositar <b>${product.price.toFixed(2)} USD</b> de tu saldo actual de <b>${user.profileData.balance.toFixed(2)} USD</b>.
            </div>

            <div className="crypto-hash-container">
              <span className="crypto-hash-label">Dirección de Depósito P2SH:</span>
              <span className="crypto-hash-value">{getCryptoAddress(paymentCoin)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setStep(2)} className="cgi-btn" disabled={isFunding}>Atrás</button>
              
              <button 
                onClick={handleFundEscrow} 
                className="cgi-btn cgi-btn-primary"
                disabled={isFunding}
              >
                {isFunding ? 'Procesando pago real...' : 'Confirmar y Pagar'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: SUCCESS */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', textAlign: 'center' }}>
            <span style={{ fontSize: '32px' }}>✅</span>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--success-color)' }}>
              ¡ORDEN PROCESADA CON ÉXITO!
            </h3>
            <p style={{ fontSize: '11px', color: '#555', lineHeight: '1.4' }}>
              Tu transacción ha sido guardada en el servidor central. El vendedor ha sido notificado para que proceda a realizar el envío físico a tu dirección.
            </p>
            <button onClick={onClose} className="cgi-btn cgi-btn-primary" style={{ width: '100%' }}>
              Ir a Mis Compras
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
