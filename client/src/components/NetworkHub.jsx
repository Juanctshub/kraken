import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'lucide-react';

export default function NetworkHub() {
  const canvasRef = useRef(null);
  const [bootstrapInput, setBootstrapInput] = useState('');
  const [peersCount, setPeersCount] = useState(148);
  const [syncHeight, setSyncHeight] = useState(843029);
  const [trafficDown, setTrafficDown] = useState(56.0); // dial-up speed (kbps)
  const [logs, setLogs] = useState([
    { type: 'info', text: 'Estableciendo protocolo de enlace dial-up con el servidor central...' },
    { type: 'info', text: 'Marcando número de la red Kraken: 091-840-KRAKEN...' },
    { type: 'success', text: 'Portadora detectada. CONNECT 56000 V.90 Standard.' },
    { type: 'info', text: 'Sincronizando tabla de enrutamiento DHT...' },
    { type: 'success', text: 'Enlace completado. Se encontraron 148 nodos activos en el mesh.' },
    { type: 'warn', text: 'Alerta: Ruido de línea excedido al 12%. Reintentando paquetes.' },
    { type: 'info', text: 'Blockchain consenso confirmado en el bloque altura: #843029.' },
  ]);

  // Handle live logs update simulation
  useEffect(() => {
    const logsTemplates = [
      { type: 'info', text: 'DHT Route: Resolviendo mapa CID QmXaYp3...' },
      { type: 'info', text: 'Mensaje gossip P2P recibido de usuario' },
      { type: 'success', text: 'Validación de token de sesión OK para nodo P2P' },
      { type: 'success', text: 'Nueva altura de consenso sincronizada #' },
      { type: 'warn', text: 'Latencia: Tiempo de respuesta lento en el servidor proxy, re-enrutando consulta...' },
      { type: 'info', text: 'Registrado nuevo contrato de garantía en el libro mayor.' },
    ];

    const interval = setInterval(() => {
      const randomTemplate = logsTemplates[Math.floor(Math.random() * logsTemplates.length)];
      let text = randomTemplate.text;
      
      if (text.includes('#')) {
        const nextBlock = syncHeight + 1;
        setSyncHeight(nextBlock);
        text = text + nextBlock;
      }
      
      setLogs(prev => [...prev.slice(-30), { type: randomTemplate.type, text }]);
      
      setPeersCount(prev => Math.max(10, prev + Math.floor(Math.random() * 3) - 1));
      setTrafficDown(parseFloat((50.0 + Math.random() * 6).toFixed(1)));
    }, 4500);

    return () => clearInterval(interval);
  }, [syncHeight]);

  // Canvas Phosphor Green Radar animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;
    canvas.width = width;
    canvas.height = height;

    const handleResize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener('resize', handleResize);

    // Green Phosphor nodes
    const nodeCount = 18;
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 2,
        pulse: Math.random() * Math.PI
      });
    }

    const packets = [];

    const draw = () => {
      ctx.fillStyle = 'rgba(7, 21, 10, 0.2)';
      ctx.fillRect(0, 0, width, height);

      // Radar circles
      ctx.strokeStyle = 'rgba(0, 204, 0, 0.08)';
      ctx.lineWidth = 1;
      const centerX = width / 2;
      const centerY = height / 2;
      for (let r = 30; r < Math.max(width, height); r += 40) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Connection lines
      ctx.strokeStyle = 'rgba(0, 204, 0, 0.15)';
      for (let i = 0; i < nodeCount; i++) {
        for (let j = i + 1; j < nodeCount; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 110) {
            const alpha = (1 - dist / 110) * 0.25;
            ctx.strokeStyle = `rgba(0, 204, 0, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();

            if (Math.random() < 0.002) {
              packets.push({
                startX: nodes[i].x,
                startY: nodes[i].y,
                endX: nodes[j].x,
                endY: nodes[j].y,
                progress: 0,
                speed: Math.random() * 0.015 + 0.008
              });
            }
          }
        }
      }

      // Packets
      ctx.fillStyle = '#00ff00';
      packets.forEach((p, idx) => {
        p.progress += p.speed;
        if (p.progress >= 1) {
          packets.splice(idx, 1);
        } else {
          const px = p.startX + (p.endX - p.startX) * p.progress;
          const py = p.startY + (p.endY - p.startY) * p.progress;
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Nodes
      nodes.forEach(node => {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        node.pulse += 0.02;

        ctx.fillStyle = 'rgba(0, 204, 0, 0.4)';
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + Math.sin(node.pulse) * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Radar Sweep
      const sweepX = centerX + Math.cos(Date.now() / 1000) * Math.max(width, height);
      const sweepY = centerY + Math.sin(Date.now() / 1000) * Math.max(width, height);
      ctx.strokeStyle = 'rgba(0, 204, 0, 0.06)';
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(sweepX, sweepY);
      ctx.stroke();

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleAddBootstrap = (e) => {
    e.preventDefault();
    if (!bootstrapInput) return;
    
    setLogs(prev => [
      ...prev,
      { type: 'info', text: `Intentando establecer enlace con dirección: ${bootstrapInput}` },
      { type: 'success', text: `Handshake verificado con éxito en el canal.` }
    ]);
    setPeersCount(prev => prev + 1);
    setBootstrapInput('');
  };

  return (
    <div>
      <div className="view-header">
        <div>
          <h2 className="view-title">Diagnóstico y Estado de Red P2P</h2>
          <p className="view-subtitle">Monitoreo de señales telefónicas y paquetes DHT del nodo local.</p>
        </div>
      </div>

      <div className="grid-cols-3">
        <div className="cgi-form-box" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '24px' }}>🌐</div>
          <div>
            <h4 style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>{peersCount}</h4>
            <span style={{ fontSize: '11px', color: '#666' }}>MALLA DE PARES ACTIVA</span>
          </div>
        </div>

        <div className="cgi-form-box" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '24px' }}>💾</div>
          <div>
            <h4 style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>#{syncHeight.toLocaleString()}</h4>
            <span style={{ fontSize: '11px', color: '#666' }}>ALTURA DE BLOQUE RED</span>
          </div>
        </div>

        <div className="cgi-form-box" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '24px' }}>📞</div>
          <div>
            <h4 style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>{trafficDown} Kb/s</h4>
            <span style={{ fontSize: '11px', color: '#666' }}>TASA DE TRANSFERENCIA DIALUP</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', marginBottom: '16px' }}>
        
        {/* Radar Panel */}
        <div className="cgi-form-box" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--success-color)' }}>[ RADAR GOSSIP TELEMETRÍA ]</span>
            <span style={{ fontSize: '11px', color: '#666' }}>DHT protocol: kademlia-dht-v1</span>
          </div>

          <div className="radar-map-canvas-container">
            <canvas ref={canvasRef} className="network-canvas" />
          </div>
        </div>

        {/* Dial Config */}
        <div className="cgi-form-box" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--accent-blue)' }}>[ CONFIGURACIÓN DIAL-UP ]</span>
          <p style={{ fontSize: '11px', color: '#666', lineHeight: '1.4' }}>
            Agrega manualmente direcciones de puerta de enlace P2P para acelerar la sincronización.
          </p>

          <form onSubmit={handleAddBootstrap} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '10px' }}>Dirección Multiaddr:</label>
              <input 
                type="text" 
                placeholder="/ip4/23.142.99.124/tcp/4001/p2p/Qm..." 
                value={bootstrapInput}
                onChange={e => setBootstrapInput(e.target.value)}
                style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <button type="submit" className="cgi-btn cgi-btn-primary" style={{ width: '100%' }}>
              MARCAR & CONECTAR
            </button>
          </form>
        </div>
      </div>

      {/* Terminal logs */}
      <div className="cgi-form-box">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <Terminal size={14} style={{ color: 'var(--success-color)' }} />
          <span style={{ fontWeight: 'bold', color: 'var(--success-color)' }}>[ REGISTRO DE TRÁFICO LOCAL DE RED ]</span>
        </div>
        <div className="terminal-logs" style={{ border: '1px solid var(--border-grey)', height: '180px' }}>
          {logs.map((log, index) => (
            <div key={index} className={`terminal-line ${log.type}`}>
              [{new Date().toLocaleTimeString()}] &gt;&gt; {log.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
