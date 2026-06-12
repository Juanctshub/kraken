import React, { useState } from 'react';
import { UploadCloud, Trash2, Edit } from 'lucide-react';

export default function MyStore({ user, products, API_BASE, onListingCreated, onListingDeleted }) {
  const [activeSubTab, setActiveSubTab] = useState('catalog');
  const [isUploading, setIsUploading] = useState(false);

  // Form State
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    category: 'Electronics',
    icon: '💿',
    condition: 'Nuevo',
    isAuction: false,
    auctionDuration: '5'
  });

  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [base64Image, setBase64Image] = useState('');

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Error: La imagen es demasiado grande. El límite de subida es de 2MB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setBase64Image(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const defaultCategories = ['Electronics', 'Storage', 'Networking', 'Audio', 'Fashion', 'Toys', 'General'];
  const categoriesSet = new Set(defaultCategories);
  products.forEach(p => {
    if (p.category) {
      categoriesSet.add(p.category);
    }
  });
  const categories = Array.from(categoriesSet);

  // Filter products published by the logged-in user
  const myListings = products.filter(p => p.seller === user.username);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalCategory = isCustomCategory ? customCategoryInput.trim() : form.category;
    if (!form.title || !form.price || !finalCategory) return;

    setIsUploading(true);

    let auctionEnd = null;
    if (form.isAuction) {
      const durationMin = parseInt(form.auctionDuration);
      auctionEnd = new Date(Date.now() + durationMin * 60 * 1000).toISOString();
    }

    try {
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          price: parseFloat(form.price),
          category: finalCategory,
          icon: form.icon,
          condition: form.condition,
          seller: user.username,
          location: user.profileData.location,
          image: base64Image || null,
          isAuction: form.isAuction,
          auctionEnd: auctionEnd
        })
      });

      if (!res.ok) throw new Error();

      setIsUploading(false);
      setForm({
        title: '',
        description: '',
        price: '',
        category: 'Electronics',
        icon: '💿',
        condition: 'Nuevo',
        isAuction: false,
        auctionDuration: '5'
      });
      setCustomCategoryInput('');
      setIsCustomCategory(false);
      setBase64Image('');
      
      alert("¡Artículo publicado con éxito en el servidor!");
      setActiveSubTab('catalog');
      onListingCreated(); // trigger refresh of listings
    } catch (err) {
      alert("Error al guardar la publicación en el servidor.");
      setIsUploading(false);
    }
  };

  const handleDeleteListing = async (productId) => {
    if (!window.confirm("¿Seguro que deseas eliminar este producto de la venta?")) return;

    try {
      const res = await fetch(`${API_BASE}/products/${productId}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error();

      alert("Publicación eliminada correctamente.");
      onListingDeleted(); // trigger refresh of listings
    } catch (err) {
      alert("Error al eliminar la publicación en el servidor.");
    }
  };

  return (
    <div>
      <div className="view-header">
        <div>
          <h2 className="view-title">Mi Tienda Descentralizada</h2>
          <p className="view-subtitle">Gestiona tu catálogo de venta, edita descripciones y publica nuevos artículos.</p>
        </div>
      </div>

      <div className="user-cp-container">
        
        {/* Submenu */}
        <aside className="user-cp-menu">
          <div className="user-cp-menu-header">Opciones de Tienda</div>
          <div 
            onClick={() => setActiveSubTab('catalog')}
            className={`user-cp-menu-item ${activeSubTab === 'catalog' ? 'active' : ''}`}
          >
            📋 Catálogo Activo ({myListings.length})
          </div>
          <div 
            onClick={() => setActiveSubTab('create')}
            className={`user-cp-menu-item ${activeSubTab === 'create' ? 'active' : ''}`}
          >
            📝 Publicar Artículo
          </div>
        </aside>

        {/* Workspace */}
        <div className="cgi-form-box">
          
          {/* CATALOG INDEX SUBTAB */}
          {activeSubTab === 'catalog' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="cgi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
                <span>Mi Catálogo en Venta</span>
                <button className="cgi-btn cgi-btn-primary" onClick={() => setActiveSubTab('create')}>
                  + PUBLICAR UN ARTÍCULO
                </button>
              </div>

              {myListings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#666', border: '1px dashed var(--border-grey)' }}>
                  Aún no tienes artículos en venta. ¡Haz clic en "Publicar Artículo" para empezar a vender!
                </div>
              ) : (
                <table className="forum-table" style={{ fontSize: '11px', margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Display</th>
                      <th>Detalles del Artículo</th>
                      <th>Categoría</th>
                      <th>Precio (USD)</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myListings.map(listing => (
                      <tr key={listing.id}>
                        <td style={{ width: '50px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', overflow: 'hidden', border: '1px solid #ccc', margin: 'auto' }}>
                            {listing.image ? (
                              <img src={listing.image} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontSize: '24px' }}>{listing.icon || '📦'}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 'bold', color: '#000', fontSize: '12px' }}>{listing.title}</span>
                          <div style={{ color: '#666', fontSize: '10px', marginTop: '2px', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {listing.description}
                          </div>
                        </td>
                        <td style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>{listing.category}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                          {listing.isAuction ? (
                            <div>
                              <span style={{ color: 'var(--price-color)', fontWeight: 'bold' }}>Subasta: ${listing.price.toFixed(2)}</span>
                              <div style={{ fontSize: '9px', color: '#666' }}>
                                {listing.auctionFinalized ? 'Finalizada 🔒' : 'Activa ⏳'}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span style={{ color: 'var(--price-color)', fontWeight: 'bold' }}>${listing.price.toFixed(2)}</span>
                              {listing.sold && (
                                <div style={{ fontSize: '9px', color: 'var(--success-color)', fontWeight: 'bold', marginTop: '2px' }}>
                                  Vendido 🛒
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <button 
                            onClick={() => handleDeleteListing(listing.id)}
                            className="cgi-btn"
                            style={{ 
                              padding: '4px', 
                              backgroundColor: '#fff0f0', 
                              borderColor: 'var(--price-color)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Eliminar publicación"
                          >
                            <Trash2 size={12} style={{ color: 'var(--price-color)' }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* CREATE LISTING SUBTAB */}
          {activeSubTab === 'create' && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="cgi-header" style={{ marginBottom: 0 }}>
                <span>Publicar Artículo (create_listing.cgi)</span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Nombre o Título del Producto*</label>
                <input 
                  type="text" 
                  placeholder="e.g. Consola Game Boy Color Lila" 
                  value={form.title} 
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  required
                  disabled={isUploading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Descripción detallada</label>
                <textarea 
                  placeholder="Especifica el estado estético, funcionamiento, accesorios incluidos..." 
                  value={form.description} 
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows="4"
                  disabled={isUploading}
                />
              </div>

              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>{form.isAuction ? 'Precio de salida (USD)*' : 'Precio comercial (USD)*'}</label>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    value={form.price} 
                    onChange={e => setForm({ ...form, price: e.target.value })}
                    required
                    disabled={isUploading}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Categoría</label>
                  <select 
                    value={isCustomCategory ? '__CUSTOM__' : form.category} 
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '__CUSTOM__') {
                        setIsCustomCategory(true);
                      } else {
                        setIsCustomCategory(false);
                        setForm({ ...form, category: val });
                      }
                    }} 
                    disabled={isUploading}
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="__CUSTOM__">+ Crear categoría personalizada...</option>
                  </select>
                  {isCustomCategory && (
                    <input 
                      type="text" 
                      placeholder="Escribe el nombre de la categoría..." 
                      value={customCategoryInput}
                      onChange={e => setCustomCategoryInput(e.target.value)}
                      style={{ marginTop: '6px' }}
                      required
                      disabled={isUploading}
                    />
                  )}
                </div>
              </div>

              {/* Auction details row */}
              <div className="form-row" style={{ border: '1px dotted #ccc', padding: '8px', backgroundColor: '#fdfdfd', alignItems: 'center' }}>
                <div className="form-group" style={{ marginBottom: 0, flexDirection: 'row', display: 'flex', gap: '8px', alignItems: 'center', flexGrow: 1 }}>
                  <input 
                    type="checkbox" 
                    id="isAuctionCheck"
                    checked={form.isAuction} 
                    onChange={e => setForm({ ...form, isAuction: e.target.checked })}
                    disabled={isUploading}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', margin: 0 }}
                  />
                  <label htmlFor="isAuctionCheck" style={{ margin: 0, fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>¿Vender mediante subasta estilo eBay?</label>
                </div>

                {form.isAuction && (
                  <div className="form-group" style={{ marginBottom: 0, width: '220px' }}>
                    <label>Duración de la Subasta</label>
                    <select 
                      value={form.auctionDuration} 
                      onChange={e => setForm({ ...form, auctionDuration: e.target.value })}
                      disabled={isUploading}
                    >
                      <option value="2">2 minutos (Prueba rápida)</option>
                      <option value="5">5 minutos</option>
                      <option value="15">15 minutos</option>
                      <option value="60">1 hora</option>
                      <option value="1440">24 horas</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Estado físico</label>
                  <select 
                    value={form.condition} 
                    onChange={e => setForm({ ...form, condition: e.target.value })}
                    disabled={isUploading}
                  >
                    <option value="Nuevo">Nuevo / Sellado</option>
                    <option value="Usado - Como Nuevo">Usado - Como Nuevo</option>
                    <option value="Usado - Buen Estado">Usado - Buen Estado</option>
                    <option value="Usado - Aceptable">Usado - Aceptable</option>
                    <option value="Reacondicionado">Reacondicionado</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Emoji del Icono (Opcional)</label>
                  <input 
                    type="text" 
                    placeholder="💿" 
                    maxLength={2}
                    value={form.icon} 
                    onChange={e => setForm({ ...form, icon: e.target.value })}
                    disabled={isUploading}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Subir Foto del Producto (Límite 2MB)</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={isUploading}
                    style={{ fontSize: '11px', padding: '4px' }}
                  />
                </div>
              </div>
              
              {base64Image && (
                <div style={{ marginTop: '4px', textAlign: 'center', border: '1px dotted #ccc', padding: '6px', backgroundColor: '#fafafa' }}>
                  <span style={{ fontSize: '10px', color: '#666', display: 'block', marginBottom: '4px' }}>Vista previa de la imagen:</span>
                  <img src={base64Image} alt="Vista previa" style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'contain', border: '1px solid #ccc' }} />
                </div>
              )}

              <button 
                type="submit" 
                className="cgi-btn cgi-btn-primary"
                disabled={isUploading || !form.title || !form.price}
                style={{ display: 'flex', gap: '8px', justifyContent: 'center', padding: '10px', marginTop: '10px' }}
              >
                <UploadCloud size={14} /> 
                {isUploading ? 'Guardando en el Servidor...' : 'Publicar Producto Ahora'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
