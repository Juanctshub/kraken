import React, { useState, useEffect } from 'react';
import { X, MessageSquare, ShoppingCart, MapPin, User, Star } from 'lucide-react';

export default function ProductDetail({ 
  product, 
  currentUser, 
  API_BASE, 
  onClose, 
  onMessageSeller, 
  onBuyNow,
  onBidPlaced
}) {
  if (!product) return null;

  const [currProd, setCurrProd] = useState(product);
  const [bidValue, setBidValue] = useState('');
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState('');
  const [timeLeft, setTimeLeft] = useState('');

  // Dynamic seller rating states
  const [sellerRating, setSellerRating] = useState('Cargando...');
  const [sellerReviewsCount, setSellerReviewsCount] = useState(0);

  useEffect(() => {
    setCurrProd(product);
    setBidError('');
    setBidValue('');
  }, [product]);

  useEffect(() => {
    if (!currProd || !API_BASE) return;
    
    fetch(`${API_BASE}/reviews/${currProd.seller}`)
      .then(res => res.json())
      .then(data => {
        const rating = data.averageRating === "Sin puntuación" ? "Sin puntuación" : `${data.averageRating} / 5.0`;
        setSellerRating(rating);
        setSellerReviewsCount(data.reviewsCount);
      })
      .catch(() => {
        setSellerRating("Sin puntuación");
        setSellerReviewsCount(0);
      });
  }, [currProd, API_BASE]);

  // Countdown timer for active auctions
  useEffect(() => {
    if (!currProd.isAuction || currProd.auctionFinalized) return;
    
    const updateTimer = () => {
      const now = new Date();
      const end = new Date(currProd.auctionEnd);
      const diff = end - now;
      if (diff <= 0) {
        setTimeLeft('¡Subasta Finalizada!');
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`Termina en: ${mins}m ${secs}s`);
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currProd]);

  const btcPrice = (currProd.price / 65000).toFixed(5);
  const minBid = currProd.highestBidder ? currProd.price + 1.00 : currProd.price;

  const currentUsername = ((currentUser && currentUser.username) || '').toLowerCase();
  const productSeller = ((currProd && currProd.seller) || '').toLowerCase();
  const isOwnProduct = !!(currentUsername && productSeller && currentUsername === productSeller);

  const handlePlaceBid = async (e) => {
    e.preventDefault();
    if (!bidValue || isSubmittingBid) return;
    
    const bidAmt = parseFloat(bidValue);
    if (bidAmt < minBid) {
      setBidError(`La oferta mínima debe ser de $${minBid.toFixed(2)} USD.`);
      return;
    }
    
    if (currentUser.profileData.balance < bidAmt) {
      setBidError("Saldo insuficiente en tu billetera.");
      return;
    }

    setIsSubmittingBid(true);
    setBidError('');

    try {
      const res = await fetch(`${API_BASE}/products/${currProd.id}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bidder: currentUser.username,
          bidAmount: bidAmt
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Error al realizar la oferta.");
      }
      
      alert("¡Tu oferta ha sido registrada en el servidor!");
      setCurrProd(data.product);
      setBidValue('');
      if (onBidPlaced) onBidPlaced();
    } catch (err) {
      setBidError(err.message);
    } finally {
      setIsSubmittingBid(false);
    }
  };

  return (
    <div className="cgi-form-box" style={{ backgroundColor: '#ffffff', border: '1px solid #aaa' }}>
      
      {/* Title bar / Header breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: '8px', marginBottom: '16px' }}>
        <span style={{ fontSize: '11px', color: '#666' }}>
          KrakenMarket &gt; {currProd.category} &gt; <b>{currProd.title}</b>
        </span>
        <a onClick={onClose} style={{ fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
          [ Volver al listado ]
        </a>
      </div>

      <div className="item-detail-container">
        
        {/* Left Column: Big Image/Emoji */}
        <div>
          <div className="item-image-box" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {currProd.image ? (
              <img src={currProd.image} alt={currProd.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              currProd.icon || '📦'
            )}
          </div>
          <div style={{ marginTop: '10px', textAlign: 'center' }}>
            <span className="tag-badge tag-new" style={{ fontSize: '11px', padding: '4px 10px' }}>
              Estado: {currProd.condition}
            </span>
          </div>
        </div>

        {/* Right Column: Title, Price, Buy Actions, Seller Stats */}
        <div className="item-info-box">
          <h2 className="item-title-header">{currProd.title}</h2>
          
          <div className="item-price-row">
            <div>
              <span className="item-price-lbl">{currProd.isAuction ? (currProd.auctionFinalized || new Date(currProd.auctionEnd) < new Date() ? 'OFERTA GANADORA:' : 'OFERTA ACTUAL:') : 'PRECIO COMPRA DIRECTA:'}</span>
              <div className="item-price-val">${parseFloat(currProd.price).toFixed(2)} USD</div>
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#032b80' }}>
              {currProd.isAuction ? (
                currProd.highestBidder ? (
                  <div>Líder: <b>{currProd.highestBidder}</b></div>
                ) : (
                  'Sin ofertas aún'
                )
              ) : (
                `(${btcPrice} BTC / ETH / USDT)`
              )}
            </div>
          </div>

          <table className="item-meta-table">
            <tbody>
              <tr>
                <td className="lbl">Ubicación:</td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={12} /> {currProd.location}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="lbl">Categoría:</td>
                <td style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>{currProd.category}</td>
              </tr>
              <tr>
                <td className="lbl">Publicado por:</td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <User size={12} /> {currProd.seller}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="lbl">Calificación vendedor:</td>
                <td style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>
                  {sellerRating} ({sellerReviewsCount} valoraciones)
                </td>
              </tr>
              {currProd.isAuction && currProd.auctionEnd && (
                <tr>
                  <td className="lbl">Finaliza:</td>
                  <td style={{ fontWeight: 'bold', color: '#b8860b' }}>
                    {new Date(currProd.auctionEnd).toLocaleString()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Action Buttons & Bidding Form */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button 
                className="cgi-btn" 
                style={{ flexGrow: 1, display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center', padding: '10px' }}
                onClick={() => onMessageSeller(currProd)}
                disabled={isOwnProduct}
              >
                <MessageSquare size={14} /> Contactar al vendedor
              </button>

              {isOwnProduct ? (
                <div style={{ 
                  flexGrow: 1, 
                  backgroundColor: '#f5f5f5', 
                  border: '1px solid #ccc', 
                  color: '#666', 
                  fontSize: '11px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  padding: '10px',
                  fontWeight: 'bold',
                  height: '34px',
                  boxSizing: 'border-box'
                }}>
                  Es tu propio artículo
                </div>
              ) : !currProd.isAuction ? (
                currProd.sold ? (
                  <div style={{ 
                    flexGrow: 1, 
                    backgroundColor: '#fff0f0', 
                    border: '1px solid var(--price-color)', 
                    color: 'var(--price-color)', 
                    fontSize: '11px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: '10px',
                    fontWeight: 'bold',
                    height: '34px',
                    boxSizing: 'border-box'
                  }}>
                    Agotado / Vendido 🛒
                  </div>
                ) : (
                  <button 
                    className="cgi-btn cgi-btn-primary" 
                    style={{ flexGrow: 1, display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center', padding: '10px' }}
                    onClick={() => onBuyNow(currProd)}
                  >
                    <ShoppingCart size={14} /> Comprar con Escrow
                  </button>
                )
              ) : null}
            </div>

            {/* Bidding box for other users */}
            {currProd.isAuction && currentUser && !isOwnProduct && (
              currProd.auctionFinalized || new Date(currProd.auctionEnd) < new Date() ? (
                <div style={{ 
                  width: '100%', 
                  backgroundColor: '#f5f5f5', 
                  border: '1px solid #ccc', 
                  color: '#555', 
                  fontSize: '11px', 
                  padding: '10px',
                  fontWeight: 'bold',
                  textAlign: 'center'
                }}>
                  Subasta Finalizada 🔒 {currProd.highestBidder ? `Ganador: ${currProd.highestBidder}` : 'Sin ofertas registradas.'}
                </div>
              ) : (
                <form onSubmit={handlePlaceBid} style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px dotted #b8860b', padding: '12px', backgroundColor: '#fffdf0', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold' }}>
                    <span>Hacer una oferta (Pujar en Subasta):</span>
                    <span style={{ color: '#b8860b' }}>{timeLeft}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input 
                      type="number" 
                      step="0.01"
                      min={minBid}
                      value={bidValue}
                      onChange={e => setBidValue(e.target.value)}
                      placeholder={`Oferta mín: $${minBid.toFixed(2)}`}
                      style={{ height: '30px', fontSize: '11px', flexGrow: 1 }}
                      required
                      disabled={isSubmittingBid}
                    />
                    <button 
                      type="submit" 
                      className="cgi-btn cgi-btn-primary" 
                      style={{ padding: '0 16px', height: '30px', fontSize: '11px' }}
                      disabled={isSubmittingBid}
                    >
                      Realizar Puja
                    </button>
                  </div>
                  {bidError && (
                    <span style={{ fontSize: '10px', color: 'var(--price-color)', display: 'block' }}>{bidError}</span>
                  )}
                </form>
              )
            )}

            {/* Bidding status message for the seller */}
            {currProd.isAuction && currentUser && isOwnProduct && (
              <div style={{ 
                width: '100%', 
                backgroundColor: '#f6f9fc', 
                border: '1px solid #b7cde6', 
                color: '#032b80', 
                fontSize: '11px', 
                padding: '10px',
                textAlign: 'center'
              }}>
                <b>Estado de tu Subasta:</b> {currProd.auctionFinalized || new Date(currProd.auctionEnd) < new Date() ? 'Finalizada 🔒' : `Activa ⏳ (${timeLeft})`} | {currProd.highestBidder ? `Oferta más alta: $${currProd.price.toFixed(2)} por ${currProd.highestBidder}` : 'Aún no tiene ofertas.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Description section */}
      <div style={{ borderTop: '1px solid #ccc', marginTop: '24px', paddingTop: '16px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 'bold', borderBottom: '1px dotted #ccc', paddingBottom: '6px', marginBottom: '10px' }}>
          Descripción del artículo
        </h3>
        <p style={{ fontSize: '12px', color: '#444', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
          {currProd.description}
        </p>
      </div>

      {/* Trust Escrow Warning details */}
      <div style={{ backgroundColor: '#f0f4f8', border: '1px solid #b9cde3', padding: '12px', marginTop: '20px', fontSize: '11px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <span style={{ fontSize: '24px' }}>🛡️</span>
        <div>
          <b>Kraken Protección al Comprador:</b> El pago no se liberará al vendedor hasta que confirmes la recepción y el correcto estado del artículo. En caso de problemas, puedes iniciar una disputa arbitral.
        </div>
      </div>
    </div>
  );
}
