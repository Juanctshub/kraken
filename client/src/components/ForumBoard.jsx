import React, { useState, useEffect } from 'react';
import { MessageSquare, FileText, User, Clock, ArrowLeft, Send } from 'lucide-react';

export default function ForumBoard({ API_BASE, user }) {
  const [threads, setThreads] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All'); // 'All', 'security', 'arbitrage', 'scammers'
  const [activeThreadId, setActiveThreadId] = useState(null); // view specific thread replies
  const [isCreatingThread, setIsCreatingThread] = useState(false);

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('security');
  const [newContent, setNewContent] = useState('');
  const [isSubmittingThread, setIsSubmittingThread] = useState(false);

  const [newReplyContent, setNewReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const categories = [
    { id: 'security', name: '🔐 Seguridad y PGP', desc: 'Debate sobre claves, encriptación PGP y seguridad del monedero.' },
    { id: 'arbitrage', name: '⚖️ Reseñas de Arbitraje', desc: 'Calificaciones, disputas y opiniones de los árbitros del Escrow.' },
    { id: 'scammers', name: '🛑 Reporte de Estafas', desc: 'Lista negra. Reporta nodos de spam, fraudes o envíos vacíos.' }
  ];

  const fetchThreads = async () => {
    try {
      const res = await fetch(`${API_BASE}/forum/threads`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setThreads(data);
    } catch (err) {
      console.error("Error fetching forum threads.");
    }
  };

  useEffect(() => {
    fetchThreads();
    // Poll forum threads every 4 seconds to sync messages
    const interval = setInterval(fetchThreads, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateThreadSubmit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    setIsSubmittingThread(true);

    try {
      const res = await fetch(`${API_BASE}/forum/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: newCategory,
          title: newTitle,
          content: newContent,
          author: user.username
        })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      
      setNewTitle('');
      setNewContent('');
      setIsCreatingThread(false);
      fetchThreads();
      setActiveThreadId(data.id); // View the newly created thread
    } catch (err) {
      alert("Error al publicar el hilo en el foro.");
    } finally {
      setIsSubmittingThread(false);
    }
  };

  const handleCreateReplySubmit = async (e) => {
    e.preventDefault();
    if (!newReplyContent.trim()) return;
    setIsSubmittingReply(true);

    try {
      const res = await fetch(`${API_BASE}/forum/threads/${activeThreadId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newReplyContent,
          author: user.username
        })
      });
      if (!res.ok) throw new Error();
      
      setNewReplyContent('');
      fetchThreads(); // refresh list
    } catch (err) {
      alert("Error al enviar la respuesta.");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const activeThread = threads.find(t => t.id === activeThreadId);

  // Filter threads by sub-forum category
  const filteredThreads = threads.filter(t => selectedCategory === 'All' || t.category === selectedCategory);

  const getCategoryName = (catId) => {
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.name : catId;
  };

  return (
    <div>
      <div className="view-header">
        <div>
          <h2 className="view-title">Bazar Kraken - Foros de Discusión Segura</h2>
          <p className="view-subtitle">Foro de la comunidad P2P. vB-Kraken Board v1.2 (phpBB style)</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: activeThreadId ? '1fr' : '220px 1fr', gap: '20px' }}>
        
        {/* LEFT COLUMN: CATEGORIES FILTER (Only when not viewing active thread) */}
        {!activeThreadId && (
          <aside style={{ borderRight: '1px solid #ddd', paddingRight: '16px' }}>
            <h3 style={{ fontSize: '11px', fontWeight: 'bold', borderBottom: '1px solid #ccc', paddingBottom: '6px', marginBottom: '8px', color: '#000080' }}>
              Secciones del Foro
            </h3>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
              <li>
                <a 
                  onClick={() => setSelectedCategory('All')} 
                  style={{ 
                    fontWeight: selectedCategory === 'All' ? 'bold' : 'normal',
                    textDecoration: selectedCategory === 'All' ? 'none' : 'underline',
                    color: selectedCategory === 'All' ? '#000' : 'var(--link-color)'
                  }}
                >
                  📝 Mostrar todos los hilos
                </a>
              </li>
              {categories.map(cat => (
                <li key={cat.id}>
                  <a 
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{ 
                      fontWeight: selectedCategory === cat.id ? 'bold' : 'normal',
                      textDecoration: selectedCategory === cat.id ? 'none' : 'underline',
                      color: selectedCategory === cat.id ? '#000' : 'var(--link-color)'
                    }}
                  >
                    {cat.name}
                  </a>
                  <span style={{ fontSize: '9px', color: '#888', marginLeft: '4px' }}>
                    ({threads.filter(t => t.category === cat.id).length})
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        )}

        {/* RIGHT COLUMN: MAIN WORKSPACE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* VIEW 1: VIEWING THREAD REPLIES */}
          {activeThreadId && activeThread ? (
            <div className="cgi-form-box" style={{ backgroundColor: '#fff', padding: '16px' }}>
              {/* Back Button */}
              <button 
                onClick={() => setActiveThreadId(null)} 
                className="cgi-btn" 
                style={{ marginBottom: '14px', display: 'flex', gap: '4px', alignItems: 'center' }}
              >
                <ArrowLeft size={12} /> Volver al Foro
              </button>

              <div className="cgi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0, paddingBottom: '8px', borderBottom: '2px solid #000080' }}>
                <span>[Tema] {activeThread.title}</span>
                <span className="tag-badge tag-refurbished" style={{ fontSize: '10px' }}>
                  {getCategoryName(activeThread.category)}
                </span>
              </div>

              {/* OP / ORIGINAL POST */}
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', border: '1px solid #ddd', marginTop: '14px', backgroundColor: '#f9fbfd' }}>
                {/* Author profile block */}
                <div style={{ borderRight: '1px solid #ddd', padding: '10px', backgroundColor: '#eef3f7', fontSize: '11px', textAlign: 'center' }}>
                  <span style={{ fontSize: '28px', display: 'block', marginBottom: '4px' }}>👤</span>
                  <b style={{ color: '#032b80', wordBreak: 'break-all' }}>{activeThread.author}</b>
                  <div style={{ color: '#666', fontSize: '9px', marginTop: '2px' }}>Miembro Kraken</div>
                </div>
                {/* Post body */}
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: '12px', color: '#111', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                    {activeThread.content}
                  </p>
                  <div style={{ textAlign: 'right', fontSize: '9px', color: '#888', borderTop: '1px dotted #ccc', paddingTop: '6px', marginTop: '12px' }}>
                    <Clock size={8} style={{ display: 'inline', marginRight: '3px' }} />
                    Publicado: {new Date(activeThread.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* REPLIES LIST */}
              {activeThread.replies && activeThread.replies.map((reply, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', border: '1px solid #ddd', marginTop: '10px', backgroundColor: '#ffffff' }}>
                  <div style={{ borderRight: '1px solid #ddd', padding: '10px', backgroundColor: '#f5f5f5', fontSize: '11px', textAlign: 'center' }}>
                    <span style={{ fontSize: '24px', display: 'block', marginBottom: '4px' }}>💬</span>
                    <b style={{ color: '#555', wordBreak: 'break-all' }}>{reply.author}</b>
                    <div style={{ color: '#888', fontSize: '9px', marginTop: '2px' }}>Comentarista</div>
                  </div>
                  <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: '12px', color: '#222', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                      {reply.content}
                    </p>
                    <div style={{ textAlign: 'right', fontSize: '9px', color: '#888', borderTop: '1px dotted #ccc', paddingTop: '6px', marginTop: '12px' }}>
                      <Clock size={8} style={{ display: 'inline', marginRight: '3px' }} />
                      Respondido: {new Date(reply.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}

              {/* POST REPLY FORM */}
              <form onSubmit={handleCreateReplySubmit} style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', color: '#000080' }}>
                  Responder a este Hilo (post_reply.cgi)
                </h4>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <textarea 
                    value={newReplyContent}
                    onChange={e => setNewReplyContent(e.target.value)}
                    placeholder="Escribe tu respuesta aquí. Sé respetuoso y sigue las normas del foro..."
                    rows={4}
                    required
                    disabled={isSubmittingReply}
                  />
                </div>
                <button 
                  type="submit" 
                  className="cgi-btn cgi-btn-primary" 
                  style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '8px' }}
                  disabled={isSubmittingReply}
                >
                  <Send size={12} />
                  {isSubmittingReply ? 'Enviando...' : 'Publicar Respuesta'}
                </button>
              </form>
            </div>
          ) : isCreatingThread ? (
            // VIEW 2: CREATING NEW THREAD FORM
            <div className="cgi-form-box" style={{ backgroundColor: '#fff' }}>
              <div className="cgi-header">
                <span>Publicar Nuevo Tema en el Foro (create_thread.cgi)</span>
              </div>

              <form onSubmit={handleCreateThreadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-row">
                  <div className="form-group" style={{ margin: 0, flexGrow: 1 }}>
                    <label>Título del Tema*</label>
                    <input 
                      type="text" 
                      placeholder="Escribe un título claro y conciso..." 
                      value={newTitle} 
                      onChange={e => setNewTitle(e.target.value)} 
                      required 
                      disabled={isSubmittingThread}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0, width: '220px' }}>
                    <label>Sección del Foro*</label>
                    <select 
                      value={newCategory} 
                      onChange={e => setNewCategory(e.target.value)}
                      disabled={isSubmittingThread}
                    >
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Contenido del Post*</label>
                  <textarea 
                    value={newContent} 
                    onChange={e => setNewContent(e.target.value)} 
                    placeholder="Escribe los detalles de tu consulta o debate..." 
                    rows={6} 
                    required 
                    disabled={isSubmittingThread}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button 
                    type="submit" 
                    className="cgi-btn cgi-btn-primary"
                    disabled={isSubmittingThread || !newTitle.trim() || !newContent.trim()}
                  >
                    {isSubmittingThread ? 'Publicando...' : 'Crear Tema'}
                  </button>
                  <button 
                    type="button" 
                    className="cgi-btn" 
                    onClick={() => setIsCreatingThread(false)}
                    disabled={isSubmittingThread}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          ) : (
            // VIEW 3: THREADS LIST TABLE
            <div className="cgi-form-box" style={{ backgroundColor: '#fff', padding: '16px' }}>
              <div className="cgi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
                <span>Temas de la Comunidad - {selectedCategory === 'All' ? 'Foro Completo' : getCategoryName(selectedCategory)}</span>
                <button className="cgi-btn cgi-btn-primary" onClick={() => setIsCreatingThread(true)}>
                  + NUEVO TEMA
                </button>
              </div>

              {selectedCategory !== 'All' && (
                <div style={{ padding: '8px', backgroundColor: '#f6f6f6', border: '1px solid #ddd', fontSize: '11px', marginTop: '10px', color: '#555' }}>
                  {categories.find(c => c.id === selectedCategory)?.desc}
                </div>
              )}

              {filteredThreads.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#888', border: '1px dashed #ccc', marginTop: '12px' }}>
                  No hay hilos de discusión creados en esta sección todavía. ¡Sé el primero en iniciar un debate!
                </div>
              ) : (
                <table className="forum-table" style={{ fontSize: '11px', margin: '12px 0 0 0' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>Icono</th>
                      <th>Tema / Iniciador</th>
                      <th>Sección</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Respuestas</th>
                      <th>Último Mensaje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredThreads.slice().reverse().map(thread => (
                      <tr key={thread.id}>
                        <td style={{ textAlign: 'center', fontSize: '18px', verticalAlign: 'middle' }}>
                          <MessageSquare size={16} style={{ color: 'var(--accent-blue)', margin: 'auto' }} />
                        </td>
                        <td>
                          <a 
                            onClick={() => setActiveThreadId(thread.id)}
                            style={{ fontWeight: 'bold', fontSize: '12px', color: 'var(--link-color)', textDecoration: 'underline' }}
                          >
                            {thread.title}
                          </a>
                          <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                            Por: <b>{thread.author}</b>
                          </div>
                        </td>
                        <td style={{ verticalAlign: 'middle', fontWeight: 'bold', color: '#555' }}>
                          {getCategoryName(thread.category).split(' ')[1]}
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 'bold', verticalAlign: 'middle' }}>
                          {thread.replies ? thread.replies.length : 0}
                        </td>
                        <td style={{ fontSize: '9px', color: '#888', verticalAlign: 'middle' }}>
                          {thread.replies && thread.replies.length > 0 ? (
                            <div>
                              Por: <b>{thread.replies[thread.replies.length - 1].author}</b>
                              <div style={{ marginTop: '1px' }}>
                                {new Date(thread.replies[thread.replies.length - 1].timestamp).toLocaleDateString()}
                              </div>
                            </div>
                          ) : (
                            <div>
                              Por: <b>{thread.author}</b>
                              <div style={{ marginTop: '1px' }}>
                                {new Date(thread.timestamp).toLocaleDateString()}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
