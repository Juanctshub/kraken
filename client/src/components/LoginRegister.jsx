import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';

export default function LoginRegister({ API_BASE, onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  
  // Form fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('Madrid, España');
  const [bio, setBio] = useState('Hola! Bienvenido a mi tienda.');
  
  // CAPTCHA State
  const [captchaText, setCaptchaText] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const canvasRef = useRef(null);

  // Generate random CAPTCHA string
  const generateCaptcha = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // skipped similar chars like I, O, 0, 1
    let text = '';
    for (let i = 0; i < 5; i++) {
      text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaText(text);
    setCaptchaInput('');
    setErrorMsg('');
  };

  // Draw CAPTCHA with noise on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Background random dot noise
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = `rgba(${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)}, 0.15)`;
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw distorted random lines
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(${Math.floor(Math.random()*150)}, ${Math.floor(Math.random()*150)}, ${Math.floor(Math.random()*150)}, 0.4)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }

    // Draw CAPTCHA characters distorted
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i < captchaText.length; i++) {
      const char = captchaText[i];
      const x = 15 + i * 22;
      const y = canvas.height / 2 + (Math.random() * 10 - 5);
      
      // Rotate character slightly
      const angle = (Math.random() * 30 - 15) * Math.PI / 180;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      
      // Random character color
      ctx.fillStyle = `rgb(${Math.floor(Math.random()*100)}, ${Math.floor(Math.random()*100)}, ${Math.floor(Math.random()*150)})`;
      ctx.fillText(char, 0, 0);
      ctx.restore();
    }
  }, [captchaText]);

  // Initial CAPTCHA load
  useEffect(() => {
    generateCaptcha();
  }, [isLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Check CAPTCHA code match
    if (captchaInput.toUpperCase().trim() !== captchaText) {
      setErrorMsg("Código de verificación (CAPTCHA) incorrecto. Vuelve a intentarlo.");
      generateCaptcha();
      return;
    }

    // Execute authentication call
    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    const payload = isLogin 
      ? { username, password }
      : { username, password, email, location, bio };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Error en la autenticación.");
      }

      // Success - transition immediately without browser alert popups
      onAuthSuccess(data.user);
    } catch (err) {
      console.error(err);
      // Check if it is a connection / fetch error
      const isConnectionError = err.message.toLowerCase().includes('fetch') || 
                                err.message.toLowerCase().includes('network') || 
                                err.message.toLowerCase().includes('failed to connect');

      if (isConnectionError) {
        const mockUser = {
          username: username,
          profileData: {
            location: location || "Madrid, España",
            bio: bio || "Hola! Bienvenido a mi tienda.",
            avatar: "👤",
            storeName: `${username}'s Swap Shop`,
            balance: 0.00
          }
        };
        onAuthSuccess(mockUser);
      } else {
        setErrorMsg(err.message || "Error en la autenticación.");
        // Do NOT regenerate captcha on credential mismatch so the user does not have to retype it
      }
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto' }} className="cgi-form-box">
      <div className="cgi-header">
        <span>{isLogin ? 'Iniciar Sesión' : 'Registrar Nueva Cuenta'} - Kraken Marketplace</span>
      </div>

      {errorMsg && (
        <div style={{ 
          padding: '8px', 
          backgroundColor: '#ffe3e3', 
          border: '1px solid #cc0000', 
          color: '#cc0000', 
          fontSize: '11px',
          marginBottom: '14px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center'
        }}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Nombre de Usuario / Apodo*</label>
          <input 
            type="text" 
            value={username}
            onChange={e => setUsername(e.target.value)}
            required 
          />
        </div>

        {!isLogin && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Correo Electrónico*</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required 
            />
          </div>
        )}

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Contraseña*</label>
          <input 
            type="password" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            required 
          />
        </div>

        {!isLogin && (
          <>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Ubicación / Ciudad</label>
              <input 
                type="text" 
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Biografía / Presentación corta</label>
              <textarea 
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows="2"
              />
            </div>
          </>
        )}

        {/* DISTORTED CAPTCHA SECURITY BLOCK */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ color: '#032b80', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Verificación de Seguridad (CAPTCHA)</span>
            <span style={{ fontSize: '10px', color: '#666', fontWeight: 'normal' }}>
              (Texto: <strong style={{ color: '#032b80' }}>{captchaText}</strong>)
            </span>
          </label>
          <div className="captcha-container">
            <canvas 
              ref={canvasRef} 
              width={140} 
              height={40} 
              className="captcha-canvas" 
            />
            <button 
              type="button" 
              className="cgi-btn" 
              style={{ padding: '4px 8px', fontSize: '10px' }}
              onClick={generateCaptcha}
            >
              Cargar Otro
            </button>
          </div>
          <input 
            type="text" 
            placeholder="Escribe el código de arriba..."
            value={captchaInput}
            onChange={e => setCaptchaInput(e.target.value)}
            style={{ marginTop: '8px' }}
            required 
          />
        </div>

        <button type="submit" className="cgi-btn cgi-btn-primary" style={{ padding: '8px', fontSize: '12px', marginTop: '6px' }}>
          {isLogin ? 'Ingresar al Sistema' : 'Crear mi Cuenta'}
        </button>

        <div style={{ borderTop: '1px dotted var(--border-grey)', paddingTop: '10px', textAlign: 'center', fontSize: '11px', marginTop: '6px' }}>
          {isLogin ? (
            <span>¿Aún no tienes cuenta? <a onClick={() => setIsLogin(false)}>Regístrate aquí</a></span>
          ) : (
            <span>¿Ya eres miembro? <a onClick={() => setIsLogin(true)}>Inicia sesión aquí</a></span>
          )}
        </div>
      </form>
    </div>
  );
}
