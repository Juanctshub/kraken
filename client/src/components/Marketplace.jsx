import React from 'react';
import { Search, Info, Sliders, MessageSquare } from 'lucide-react';

export default function Marketplace({ 
  products, 
  selectedCategory, 
  setSelectedCategory, 
  searchQuery, 
  setSearchQuery,
  onProductClick,
  setCurrentRoute
}) {
  const activeProducts = products.filter(product => {
    if (product.isAuction && product.auctionFinalized) return false;
    if (!product.isAuction && product.sold) return false;
    return true;
  });

  const defaultCategories = ['Electronics', 'Storage', 'Networking', 'Audio', 'Fashion', 'Toys', 'General'];
  const categoriesSet = new Set(defaultCategories);
  activeProducts.forEach(p => {
    if (p.category) {
      categoriesSet.add(p.category);
    }
  });
  const categories = ['All', ...Array.from(categoriesSet)];

  // Filter products by search and category
  const filteredProducts = activeProducts.filter(product => {
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    
    const title = product.title || '';
    const description = product.description || '';
    const seller = product.seller || '';
    
    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          seller.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getConditionBadge = (condition) => {
    const cond = (condition || '').toLowerCase();
    if (cond.includes('new') || cond.includes('nuevo')) return <span className="tag-badge tag-new">Nuevo</span>;
    if (cond.includes('refurbished') || cond.includes('reacondicionado')) return <span className="tag-badge tag-refurbished">Reacondicionado</span>;
    return <span className="tag-badge tag-used">Usado</span>;
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '20px' }}>
        
        {/* Left Side Categories (Craigslist/eBay 2000s style list) */}
        <aside style={{ borderRight: '1px solid #ddd', paddingRight: '16px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 'bold', borderBottom: '1px solid #ccc', paddingBottom: '6px', marginBottom: '8px' }}>
            Categorías
          </h3>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {categories.map(cat => (
              <li key={cat}>
                <a 
                  onClick={() => setSelectedCategory(cat)}
                  style={{ 
                    fontWeight: selectedCategory === cat ? 'bold' : 'normal',
                    textDecoration: selectedCategory === cat ? 'none' : 'underline',
                    color: selectedCategory === cat ? '#000' : 'var(--link-color)'
                  }}
                >
                  {cat === 'All' ? 'Todos los artículos' : cat}
                </a>
                <span style={{ fontSize: '10px', color: '#888', marginLeft: '4px' }}>
                  ({cat === 'All' ? activeProducts.length : activeProducts.filter(p => p.category === cat).length})
                </span>
              </li>
            ))}
          </ul>

          <div style={{ borderTop: '1px dotted #ccc', paddingTop: '10px', marginTop: '16px', fontSize: '11px', color: '#666' }}>
            <p><b>Mercado Local Kraken:</b></p>
            <p style={{ marginTop: '4px' }}>Transacciones protegidas con depósitos en garantía (Escrow).</p>
          </div>
        </aside>

        {/* Right Side Products Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Search Box */}
          <div className="cgi-form-box" style={{ padding: '8px 12px', display: 'flex', gap: '10px', alignItems: 'center', marginBottom: 0 }}>
            <span style={{ fontWeight: 'bold', fontSize: '11px' }}>¿Qué buscas hoy?:</span>
            <div style={{ position: 'relative', flexGrow: 1 }}>
              <input 
                type="text" 
                placeholder="Busca productos por título, descripción o vendedor..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ height: '28px', fontSize: '12px' }}
              />
            </div>
          </div>

          {/* List of items */}
          {filteredProducts.length === 0 ? (
            <div className="empty-marketplace-banner">
              {activeProducts.length === 0 ? (
                <span>
                  No hay artículos publicados todavía en KrakenMarket. ¡Sé el primero en 
                  <a onClick={() => setCurrentRoute('store')} style={{ margin: '0 4px', fontWeight: 'bold' }}>
                    crear tu tienda y publicar un producto
                  </a>!
                </span>
              ) : (
                <span>No se encontraron productos que coincidan con la búsqueda.</span>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredProducts.map(product => (
                <div 
                  key={product.id}
                  onClick={() => onProductClick(product)}
                  style={{ 
                    border: '1px solid var(--border-grey)', 
                    padding: '12px', 
                    display: 'grid', 
                    gridTemplateColumns: '80px 1fr 140px', 
                    gap: '16px',
                    cursor: 'pointer',
                    backgroundColor: '#ffffff'
                  }}
                  className="marketplace-item-row"
                >
                  {/* Emoji Avatar/Image */}
                  <div style={{ 
                    fontSize: '48px', 
                    backgroundColor: '#fafafa', 
                    border: '1px solid #eee', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '80px',
                    width: '80px',
                    overflow: 'hidden'
                  }}>
                    {product.image ? (
                      <img src={product.image} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      product.icon || '📦'
                    )}
                  </div>

                  {/* Body Info */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 className="board-title" style={{ fontSize: '14px', textDecoration: 'underline', margin: 0 }}>
                        {product.title}
                      </h3>
                      {product.isAuction && (
                        <span 
                          className="tag-badge" 
                          style={{ 
                            fontSize: '9px', 
                            padding: '1px 5px', 
                            color: product.auctionFinalized ? '#555' : '#b8860b',
                            borderColor: product.auctionFinalized ? '#999' : '#b8860b',
                            backgroundColor: product.auctionFinalized ? '#eee' : '#fffdf0'
                          }}
                        >
                          {product.auctionFinalized ? 'SUBASTA FINALIZADA 🔒' : 'SUBASTA ACTIVA ⏳'}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '11px', color: '#666', marginTop: '4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {product.description}
                    </p>
                    
                    {product.isAuction && !product.auctionFinalized && product.auctionEnd && (
                      <div style={{ fontSize: '10px', color: '#b8860b', fontWeight: 'bold', marginTop: '6px' }}>
                        ⏳ Cierre de subasta: {new Date(product.auctionEnd).toLocaleString()}
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: '12px', fontSize: '10px', color: '#888', marginTop: '8px' }}>
                      <span>Vendedor: <b>{product.seller}</b></span>
                      <span>Ubicación: <b>{product.location}</b></span>
                      <span>Categoría: <b>{product.category}</b></span>
                    </div>
                  </div>

                  {/* Price & Details */}
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--price-color)', fontFamily: 'var(--font-mono)' }}>
                        ${parseFloat(product.price).toFixed(2)} USD
                      </div>
                      <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>
                        {product.isAuction ? (
                          <span style={{ color: '#b8860b', fontWeight: 'bold' }}>
                            {product.highestBidder ? `Oferta de: ${product.highestBidder}` : 'Sin ofertas aún'}
                          </span>
                        ) : (
                          `${(product.price / 65000).toFixed(5)} BTC`
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: '10px' }}>
                      {getConditionBadge(product.condition)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
