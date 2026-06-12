import React, { useState } from 'react';
import { Truck, Clock, CheckCircle2, ShieldAlert, Star } from 'lucide-react';

export default function EscrowOrders({ orders, user, API_BASE, onOrderUpdated }) {
  // Reviews state
  const [reviewingOrderId, setReviewingOrderId] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Receipt Modal State
  const [activeReceiptOrder, setActiveReceiptOrder] = useState(null);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'funded':
        return <span className="tag-badge tag-used" style={{ color: '#b8860b', borderColor: '#b8860b', backgroundColor: '#fffdf0' }}>FONDO DEPOSITADO (ESPERANDO ENVÍO)</span>;
      case 'shipped':
        return <span className="tag-badge tag-refurbished">ARTÍCULO ENVIADO (EN TRÁNSITO)</span>;
      case 'completed':
        return <span className="tag-badge tag-new">COMPRA COMPLETADA</span>;
      case 'disputed':
        return <span className="tag-badge tag-used" style={{ color: 'var(--price-color)', borderColor: 'var(--price-color)', backgroundColor: '#fff0f0' }}>DISPUTA / ARBITRAJE ABIERTO</span>;
      default:
        return <span className="tag-badge">{status.toUpperCase()}</span>;
    }
  };

  const handleSimulateShipping = async (orderId) => {
    const trackingNum = 'USPS-940550' + Math.floor(100000000000 + Math.random() * 900000000000);
    
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'shipped', trackingNumber: trackingNum })
      });
      if (!res.ok) throw new Error();

      alert(`¡Artículo marcado como enviado! Tracking ID: ${trackingNum}`);
      onOrderUpdated();
    } catch (err) {
      alert("Error al actualizar envío en el servidor.");
    }
  };

  const handleReleaseFunds = async (orderId, price, seller) => {
    try {
      // 1. Mark order as completed on backend
      const orderRes = await fetch(`${API_BASE}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      if (!orderRes.ok) throw new Error("Could not update order status.");

      // 2. Add balance to the seller on backend
      const sellerProfileRes = await fetch(`${API_BASE}/auth/profile/${seller}`);
      if (!sellerProfileRes.ok) throw new Error("Could not fetch seller profile.");
      const sellerProfile = await sellerProfileRes.json();
      
      const newSellerBalance = sellerProfile.balance + parseFloat(price);
      
      const updateBalanceRes = await fetch(`${API_BASE}/auth/profile/${seller}/balance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: newSellerBalance })
      });
      if (!updateBalanceRes.ok) throw new Error("Could not release funds to seller.");

      alert("¡Firma digital verificada! Fondos liberados del depósito en garantía y transferidos al vendedor.");
      onOrderUpdated();
    } catch (err) {
      alert("Error al liberar fondos en el servidor: " + err.message);
    }
  };

  const handleRaiseDispute = async (orderId) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'disputed' })
      });
      if (!res.ok) throw new Error();

      alert("Disputa abierta. El árbitro asignado revisará las firmas e historial del chat.");
      onOrderUpdated();
    } catch (err) {
      alert("Error al iniciar arbitraje en el servidor.");
    }
  };

  const handleResolveDispute = async (orderId, action) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/dispute-resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Error al resolver la disputa.");
      }

      alert(data.message);
      onOrderUpdated();
    } catch (err) {
      alert("Error al resolver disputa: " + err.message);
    }
  };

  const handleReviewSubmit = async (e, orderId, seller) => {
    e.preventDefault();
    if (reviewRating < 1 || reviewRating > 5) return;
    setIsSubmittingReview(true);

    try {
      const res = await fetch(`${API_BASE}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          rating: reviewRating,
          comment: reviewComment,
          fromUser: user.username,
          toUser: seller
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al subir la reseña.");

      alert("¡Valoración guardada y reputación del vendedor actualizada!");
      setReviewingOrderId(null);
      setReviewComment('');
      setReviewRating(5);
      onOrderUpdated();
    } catch (err) {
      alert("Error al enviar reseña: " + err.message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Receipt Generator details
  const generatePgpSignature = (order) => {
    return `-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA256

Order-ID: ${order.id}
Timestamp: ${order.timestamp}
Buyer: ${order.buyer}
Seller: ${order.seller}
Amount: ${order.price.toFixed(2)} USD
Coin: ${order.coin}
Escrow-Mode: ${order.escrowMode}
Arbiter: ${order.moderator}
Shipping-Address: ${order.shippingAddress || 'No Address'}
Status: ${order.status.toUpperCase()}

-----BEGIN PGP SIGNATURE-----
Version: GnuPG v1.4.10 (GNU/Linux)

${btoa(order.id + order.buyer + order.seller + order.price).slice(0, 40)}
${btoa(order.timestamp).slice(0, 40)}
-----END PGP SIGNATURE-----`;
  };

  const generateIntegrityChecksum = (order) => {
    let hash = '';
    const chars = 'abcdef0123456789';
    const seed = order.id + order.buyer + order.seller + order.price;
    for (let i = 0; i < 64; i++) {
      const idx = (seed.charCodeAt(i % seed.length) + i) % chars.length;
      hash += chars[idx];
    }
    return hash;
  };

  return (
    <div>
      <div className="view-header">
        <div>
          <h2 className="view-title">Registro de Compras y Escrow</h2>
          <p className="view-subtitle">Monitorea tus compras y ventas activas en el monedero de depósitos garantizados</p>
        </div>
      </div>

      <div className="cgi-form-box" style={{ backgroundColor: '#fff' }}>
        <div className="cgi-header" style={{ marginBottom: '14px' }}>
          <span>cgi-bin/escrow_ledger.cgi - Lista de Pedidos del Vendedor / Comprador</span>
        </div>

        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
            <Clock size={20} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            No se encontraron pedidos de compra ni venta registrados para este usuario en el servidor.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {orders.map((order) => {
              const isBuyer = user && user.username && order.buyer && order.buyer.toLowerCase() === user.username.toLowerCase();
              const isSeller = user && user.username && order.seller && order.seller.toLowerCase() === user.username.toLowerCase();
              
              return (
                <div 
                  key={order.id} 
                  style={{ 
                    border: '1px solid var(--border-grey)', 
                    padding: '16px', 
                    backgroundColor: '#fafafa',
                    borderLeft: `4px solid ${
                      order.status === 'completed' ? 'var(--success-color)' : 
                      order.status === 'disputed' ? 'var(--price-color)' : 
                      order.status === 'shipped' ? 'var(--accent-blue)' : '#b8860b'
                    }`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <span style={{ fontSize: '10px', color: '#666', fontFamily: 'var(--font-mono)' }}>
                        NÚMERO DE PEDIDO: {order.id} | Rol: <b>{isBuyer ? 'COMPRADOR 🛒' : 'VENDEDOR 🏬'}</b>
                      </span>
                      <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#000', marginTop: '4px' }}>
                        {order.productTitle}
                      </h4>
                      <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>
                        {isBuyer ? (
                          <span>Vendedor: <b>{order.seller}</b></span>
                        ) : (
                          <span>Comprador: <b>{order.buyer}</b></span>
                        )}
                        <span> | Arbitrador: <b>{order.moderator}</b></span>
                      </div>
                    </div>
                    
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--price-color)', fontFamily: 'var(--font-mono)' }}>
                        ${order.price.toFixed(2)} USD
                      </div>
                      <span style={{ fontSize: '9px', color: '#666' }}>
                        Asset: {order.coin}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dotted var(--border-grey)', paddingTop: '10px', marginTop: '12px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#666' }}>ESTADO:</span>
                      {getStatusBadge(order.status)}
                      {order.trackingNumber && (
                        <span style={{ fontSize: '11px', color: '#333', marginLeft: '10px', fontFamily: 'var(--font-mono)' }}>
                          TRACKING ID: <b>{order.trackingNumber}</b>
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        onClick={() => setActiveReceiptOrder(order)}
                        className="cgi-btn"
                        style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: '#f9f9f9', borderColor: '#ccc', color: '#333' }}
                      >
                        🧾 Recibo PGP CGI
                      </button>

                      {/* Seller Shipping option */}
                      {order.status === 'funded' && isSeller && (
                        <button 
                          onClick={() => handleSimulateShipping(order.id)}
                          className="cgi-btn"
                          style={{ backgroundColor: '#eef7fe', borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }}
                        >
                          Registrar Envío &rarr;
                        </button>
                      )}

                      {/* Buyer Confirm Receipt option */}
                      {order.status === 'shipped' && isBuyer && (
                        <>
                          <button 
                            onClick={() => handleRaiseDispute(order.id)}
                            className="cgi-btn"
                            style={{ backgroundColor: '#fff5f5', borderColor: 'var(--price-color)', color: 'var(--price-color)' }}
                          >
                            Abrir Disputa
                          </button>
                          <button 
                            onClick={() => handleReleaseFunds(order.id, order.price, order.seller)}
                            className="cgi-btn cgi-btn-primary"
                          >
                            Liberar Fondos (Recibido OK)
                          </button>
                        </>
                      )}

                      {order.status === 'completed' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--success-color)', fontWeight: 'bold' }}>
                            ✓ Transacción cerrada. Fondos liberados.
                          </span>
                          {isBuyer && !order.reviewed && (
                            reviewingOrderId === order.id ? (
                              <form onSubmit={(e) => handleReviewSubmit(e, order.id, order.seller)} style={{ border: '1px dashed #bbb', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: '#fff', zIndex: 10 }}>
                                <div style={{ fontSize: '10px', fontWeight: 'bold' }}>Dejar valoración del Vendedor:</div>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <label style={{ fontSize: '10px', margin: 0 }}>Puntaje:</label>
                                  <select value={reviewRating} onChange={e => setReviewRating(parseInt(e.target.value))} style={{ width: '80px', height: '22px', fontSize: '10px', padding: 0 }}>
                                    <option value={5}>⭐⭐⭐⭐⭐ (5)</option>
                                    <option value={4}>⭐⭐⭐⭐ (4)</option>
                                    <option value={3}>⭐⭐⭐ (3)</option>
                                    <option value={2}>⭐⭐ (2)</option>
                                    <option value={1}>⭐ (1)</option>
                                  </select>
                                </div>
                                <textarea 
                                  value={reviewComment}
                                  onChange={e => setReviewComment(e.target.value)}
                                  placeholder="Escribe un comentario..."
                                  rows={2}
                                  style={{ fontSize: '10px', width: '200px' }}
                                  required
                                />
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button type="submit" className="cgi-btn cgi-btn-primary" style={{ padding: '2px 6px', fontSize: '9px' }} disabled={isSubmittingReview}>
                                    {isSubmittingReview ? 'Enviando...' : 'Enviar'}
                                  </button>
                                  <button type="button" className="cgi-btn" style={{ padding: '2px 6px', fontSize: '9px' }} onClick={() => setReviewingOrderId(null)}>
                                    Cancelar
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <button 
                                onClick={() => {
                                  setReviewingOrderId(order.id);
                                  setReviewRating(5);
                                  setReviewComment('');
                                }}
                                className="cgi-btn"
                                style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: '#fffbe6', borderColor: '#ffe58f', color: '#d46b08' }}
                              >
                                📝 Dejar Valoración
                              </button>
                            )
                          )}
                          {isBuyer && order.reviewed && (
                            <span style={{ fontSize: '10px', color: '#666', fontStyle: 'italic' }}>
                              (Valoración enviada)
                            </span>
                          )}
                        </div>
                      )}

                      {order.status === 'disputed' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', border: '1px dotted var(--price-color)', padding: '8px', backgroundColor: '#fffdfd' }}>
                          <span style={{ fontSize: '11px', color: 'var(--price-color)', fontWeight: 'bold' }}>
                            ⚠ En revisión de arbitraje por {order.moderator}.
                          </span>
                          
                          {/* Real moderator actions dashboard playable by user */}
                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px', borderTop: '1px solid #ffcccc', paddingTop: '6px' }}>
                            <span style={{ fontSize: '9px', color: '#888', alignSelf: 'center', marginRight: '4px' }}><b>[ÁRBITRO]:</b></span>
                            <button 
                              onClick={() => handleResolveDispute(order.id, 'refund')}
                              className="cgi-btn"
                              style={{ fontSize: '9px', padding: '2px 6px', backgroundColor: '#ffe3e3', borderColor: 'var(--price-color)', color: 'var(--price-color)' }}
                            >
                              Reembolsar al Comprador
                            </button>
                            <button 
                              onClick={() => handleResolveDispute(order.id, 'release')}
                              className="cgi-btn"
                              style={{ fontSize: '9px', padding: '2px 6px', backgroundColor: '#eefef4', borderColor: 'var(--success-color)', color: 'var(--success-color)' }}
                            >
                              Liberar al Vendedor
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Monochrome CGI Print Sheet Modal Overlay */}
      {activeReceiptOrder && (
        <div className="modal-overlay" style={{ zIndex: 10001 }}>
          <div 
            className="print-invoice-area"
            style={{ 
              backgroundColor: '#000000', 
              color: '#00ff00', 
              fontFamily: 'var(--font-mono)', 
              padding: '24px', 
              width: '640px', 
              border: '3px double #00ff00',
              boxShadow: '0 0 20px rgba(0, 255, 0, 0.3)',
              position: 'relative'
            }}
          >
            {/* CGI Dot Matrix Printer Header */}
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #00ff00', paddingBottom: '12px', marginBottom: '16px' }}>
              <pre style={{ fontSize: '10px', lineHeight: '1.2', margin: 0 }}>
{`==================================================
      K R A K E N   M A R K E T P L A C E
     CGI-BIN / SECURE TRANSACTION INVOICE
==================================================`}
              </pre>
              <div style={{ fontSize: '11px', marginTop: '6px' }}>SYSTEM TIME: {new Date().toISOString()}</div>
            </div>

            {/* Invoice Details Grid */}
            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', color: '#00ff00', marginBottom: '16px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '150px', padding: '4px 0', fontWeight: 'bold' }}>ID DE PEDIDO:</td>
                  <td style={{ padding: '4px 0' }}>{activeReceiptOrder.id}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 0', fontWeight: 'bold' }}>FECHA COMPRA:</td>
                  <td style={{ padding: '4px 0' }}>{new Date(activeReceiptOrder.timestamp).toLocaleString()}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 0', fontWeight: 'bold' }}>COMPRADOR:</td>
                  <td style={{ padding: '4px 0' }}>{activeReceiptOrder.buyer}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 0', fontWeight: 'bold' }}>VENDEDOR:</td>
                  <td style={{ padding: '4px 0' }}>{activeReceiptOrder.seller}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 0', fontWeight: 'bold' }}>MODERADOR ESCROW:</td>
                  <td style={{ padding: '4px 0' }}>{activeReceiptOrder.moderator}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 0', fontWeight: 'bold' }}>METODO DE PAGO:</td>
                  <td style={{ padding: '4px 0' }}>{activeReceiptOrder.coin} (Simulated Crypto Network)</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 0', fontWeight: 'bold' }}>VALOR TOTAL:</td>
                  <td style={{ padding: '4px 0', fontWeight: 'bold' }}>${activeReceiptOrder.price.toFixed(2)} USD</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 0', fontWeight: 'bold' }}>DIRECCION ENVIO:</td>
                  <td style={{ padding: '4px 0' }}>{activeReceiptOrder.shippingAddress || 'No provista'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 0', fontWeight: 'bold' }}>ESTADO ACTUAL:</td>
                  <td style={{ padding: '4px 0', textTransform: 'uppercase', color: '#fff' }}>{activeReceiptOrder.status}</td>
                </tr>
              </tbody>
            </table>

            {/* PGP Signature Block */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>BLOC DE FIRMA DIGITAL PGP:</div>
              <textarea 
                readOnly
                value={generatePgpSignature(activeReceiptOrder)}
                style={{ 
                  width: '100%', 
                  height: '180px', 
                  backgroundColor: '#0a0a0a', 
                  color: '#00ff00', 
                  border: '1px solid #00ff00', 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '9px',
                  padding: '6px',
                  resize: 'none'
                }}
              />
            </div>

            {/* Integrity Hash details */}
            <div style={{ fontSize: '9px', borderTop: '1px dashed #00ff00', paddingTop: '10px', marginBottom: '20px' }}>
              <div><b>HASH INTEGRIDAD SHA-256:</b></div>
              <div style={{ wordBreak: 'break-all', color: '#fff' }}>{generateIntegrityChecksum(activeReceiptOrder)}</div>
              <div style={{ marginTop: '4px' }}>TX BLOCKCHAIN RESUME: <span style={{ color: '#fff' }}>0x{generateIntegrityChecksum(activeReceiptOrder).slice(0, 32)}</span></div>
            </div>

            {/* Print and Close buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }} className="no-print">
              <button 
                onClick={() => window.print()}
                className="cgi-btn"
                style={{ 
                  backgroundColor: '#000000', 
                  color: '#00ff00', 
                  borderColor: '#00ff00', 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '11px',
                  padding: '4px 12px'
                }}
              >
                [ Imprimir Recibo ]
              </button>
              <button 
                onClick={() => setActiveReceiptOrder(null)}
                className="cgi-btn"
                style={{ 
                  backgroundColor: '#000000', 
                  color: '#ff3333', 
                  borderColor: '#ff3333', 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '11px',
                  padding: '4px 12px'
                }}
              >
                [ Cerrar Consola ]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
