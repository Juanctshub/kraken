const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env file in root directory if it exists
const dotenvPath = path.join(__dirname, '../.env');
if (fs.existsSync(dotenvPath)) {
    const dotenvContent = fs.readFileSync(dotenvPath, 'utf8');
    dotenvContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim();
            process.env[key] = val;
        }
    });
}

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[FATAL ERROR] Uncaught Exception thrown:', err);
});

const app = express();
const PORT = process.env.PORT || 8080;

// Enable JSON parser with 50mb limit to handle Base64 images
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// =========================================================================
// MONGO DB CLIENT & SERVERLESS DATABASE SETUP
// =========================================================================
const { MongoClient } = require('mongodb');
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const client = new MongoClient(mongoUri);
let dbCollection = null;
let savePromise = null;
let connPromise = null;

const defaultDb = {
    users: [],
    products: [], 
    orders: [],
    chats: [],
    transactions: [],
    reviews: [],
    threads: [],
    pendingPurchases: [],
    nextProductId: 1,
    nextOrderId: 1,
    nextThreadId: 1
};

let db = { ...defaultDb };

async function connectToMongo() {
    if (!connPromise) {
        connPromise = client.connect().then(async () => {
            const mongoDb = client.db('kraken');
            dbCollection = mongoDb.collection('state');
            console.log("[MONGODB] Conectado exitosamente.");
            
            // Check if seed database exists, otherwise create it
            const doc = await dbCollection.findOne({ _id: 'state' });
            if (doc) {
                db = doc.data;
                console.log("[MONGODB] Estado cargado desde base de datos remota.");
            } else {
                // Seed from local db.json
                const localDbPath = path.join(__dirname, 'db.json');
                if (fs.existsSync(localDbPath)) {
                    const fileData = fs.readFileSync(localDbPath, 'utf8');
                    db = JSON.parse(fileData);
                    console.log("[MONGODB] Sembrando base de datos desde db.json local.");
                } else {
                    db = { ...defaultDb };
                    console.log("[MONGODB] Inicializando base de datos vacía.");
                }
                
                // Save initial state
                await dbCollection.replaceOne({ _id: 'state' }, { _id: 'state', data: db }, { upsert: true });
            }
            
            // Run registerBotsIfNotExist safely after load
            registerBotsIfNotExist();
        }).catch(err => {
            console.error("[MONGODB] Error de conexión:", err.message);
            connPromise = null;
        });
    }
    return connPromise;
}

// Database connection and state synchronizer middleware
app.use(async (req, res, next) => {
    // 1. Ensure connection is active
    await connectToMongo();
    
    // 2. Fetch latest state from MongoDB on every request to prevent stale container caches
    if (dbCollection) {
        try {
            const doc = await dbCollection.findOne({ _id: 'state' });
            if (doc) {
                db = doc.data;
            }
        } catch (err) {
            console.error("[MONGODB] Error actualizando estado:", err.message);
        }
    }
    
    // 3. Intercept res.send and res.json to block and await any pending writes to MongoDB
    const originalSend = res.send;
    res.send = async function (body) {
        if (savePromise) {
            await savePromise;
        }
        return originalSend.call(this, body);
    };
    
    const originalJson = res.json;
    res.json = async function (body) {
        if (savePromise) {
            await savePromise;
        }
        return originalJson.call(this, body);
    };
    
    next();
});

// Save DB
function saveDb() {
    if (!dbCollection) {
        console.warn("[MONGODB] No conectado. Ignorando guardado.");
        return;
    }
    const saveOp = dbCollection.replaceOne({ _id: 'state' }, { _id: 'state', data: db }, { upsert: true });
    savePromise = Promise.all([savePromise, saveOp])
        .then(() => { if (savePromise === saveOp) savePromise = null; })
        .catch(err => { console.error("[MONGODB] Error al guardar:", err.message); });
}

// =========================================================================
// AUTHENTICATION API
// =========================================================================

// Register new user
app.post('/api/auth/register', (req, res) => {
    const { username, password, email, location, bio } = req.body;
    
    if (!username || !password || !email) {
        return res.status(400).json({ message: "Se requieren el nombre de usuario, la contraseña y el correo electrónico." });
    }

    const userExists = db.users.some(u => u.username.toLowerCase() === username.toLowerCase());
    if (userExists) {
        return res.status(400).json({ message: "El nombre de usuario ya está registrado en Kraken." });
    }

    const newUser = {
        username,
        password, // stored plain for simplicity in local sandbox
        email,
        profileData: {
            location: location || "Desconocido",
            bio: bio || "¡Hola! Bienvenido a mi tienda.",
            avatar: "👤",
            storeName: `${username}'s Swap Shop`,
            balance: 0.00 // default starting balance $0 as requested
        }
    };

    db.users.push(newUser);
    saveDb();

    res.status(201).json({ 
        message: "Usuario registrado con éxito", 
        user: { username: newUser.username, profileData: newUser.profileData } 
    });
});

// Login user
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ message: "Se requiere nombre de usuario y contraseña." });
    }

    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
        return res.status(404).json({ message: "El usuario no existe. Regístrate en la pestaña de Registro." });
    }
    
    if (user.password !== password) {
        return res.status(401).json({ message: "La contraseña es incorrecta. Vuelve a intentarlo." });
    }

    res.json({ 
        message: "Login exitoso", 
        user: { username: user.username, profileData: user.profileData } 
    });
});

// Update profile data
app.put('/api/auth/profile/:username', (req, res) => {
    const { username } = req.params;
    const { bio, location, storeName, avatar } = req.body;

    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    if (bio !== undefined) user.profileData.bio = bio;
    if (location !== undefined) user.profileData.location = location;
    if (storeName !== undefined) user.profileData.storeName = storeName;
    if (avatar !== undefined) user.profileData.avatar = avatar;

    saveDb();
    res.json({ message: "Profile updated successfully", profileData: user.profileData });
});

// Change password
app.put('/api/auth/profile/:username/password', (req, res) => {
    const { username } = req.params;
    const { currentPassword, newPassword } = req.body;

    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (user.password !== currentPassword) {
        return res.status(400).json({ message: "La contraseña actual es incorrecta." });
    }

    user.password = newPassword;
    saveDb();
    res.json({ message: "Contraseña cambiada con éxito." });
});

// Get user profile balance/data
app.get('/api/auth/profile/:username', (req, res) => {
    const { username } = req.params;
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user.profileData);
});

// Update balance
app.put('/api/auth/profile/:username/balance', (req, res) => {
    const { username } = req.params;
    const { balance } = req.body;
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return res.status(404).json({ message: "User not found" });
    user.profileData.balance = parseFloat(balance);
    saveDb();
    res.json({ balance: user.profileData.balance });
});

// =========================================================================
// PRODUCTS / LISTINGS API
// =========================================================================

function checkExpiredAuctions() {
    const now = new Date();
    let dbChanged = false;

    db.products.forEach(product => {
        if (product.isAuction && !product.auctionFinalized && product.auctionEnd && new Date(product.auctionEnd) < now) {
            product.auctionFinalized = true;
            dbChanged = true;

            if (product.highestBidder) {
                // Create a funded Escrow Order
                const newOrder = {
                    id: 'ORD-' + (100000 + db.nextOrderId++),
                    productId: product.id,
                    productTitle: `[SUBASTA GANADA] ${product.title}`,
                    price: parseFloat(product.price),
                    buyer: product.highestBidder,
                    seller: product.seller,
                    coin: 'USDT',
                    escrowMode: 'multisig',
                    moderator: 'ArbiterNode_Kraken',
                    status: 'funded',
                    shippingAddress: 'Dirección registrada en perfil de subasta',
                    trackingNumber: null,
                    reviewed: false,
                    timestamp: new Date().toISOString()
                };
                db.orders.push(newOrder);
            }
        }
    });

    if (dbChanged) {
        saveDb();
    }
}

// Get all listings
app.get('/api/products', (req, res) => {
    checkExpiredAuctions();
    res.json(db.products);
});

// Add new listing
app.post('/api/products', (req, res) => {
    const { title, description, price, seller, category, icon, condition, location, image, isAuction, auctionEnd } = req.body;
    if (!title || !price || !seller) {
        return res.status(400).json({ message: "Title, price and seller are required." });
    }

    const newProduct = {
        id: db.nextProductId++,
        title,
        description: description || "Sin descripción disponible.",
        price: parseFloat(price),
        seller, // username of seller
        category: category || "General",
        condition: condition || "New",
        icon: icon || "📦",
        location: location || "Desconocido",
        image: image || null, // Base64 image
        isAuction: !!isAuction,
        auctionEnd: isAuction ? auctionEnd : null,
        auctionFinalized: false,
        highestBidder: null,
        timestamp: new Date().toISOString()
    };

    db.products.push(newProduct);
    saveDb();
    res.status(201).json(newProduct);
});

// Delete listing
app.delete('/api/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    db.products = db.products.filter(p => p.id !== id);
    saveDb();
    res.json({ message: "Listing deleted" });
});

// =========================================================================
// ORDERS API
// =========================================================================

// Get orders involving a user
app.get('/api/orders/:username', (req, res) => {
    checkExpiredAuctions();
    const { username } = req.params;
    const userOrders = db.orders.filter(o => 
        o.buyer.toLowerCase() === username.toLowerCase() || 
        o.seller.toLowerCase() === username.toLowerCase()
    );
    res.json(userOrders);
});

// Create new order
app.post('/api/orders', (req, res) => {
    const { productId, productTitle, price, buyer, seller, coin, escrowMode, moderator, shippingAddress } = req.body;
    
    if (!productId || !buyer || !seller || !price) {
        return res.status(400).json({ message: "Missing required order fields" });
    }

    const newOrder = {
        id: 'ORD-' + (100000 + db.nextOrderId++),
        productId,
        productTitle,
        price: parseFloat(price),
        buyer,
        seller,
        coin: coin || 'USDT',
        escrowMode: escrowMode || 'multisig',
        moderator: escrowMode === 'multisig' ? moderator : 'None',
        status: 'funded',
        shippingAddress,
        trackingNumber: null,
        reviewed: false, // track if buyer has left review feedback
        timestamp: new Date().toISOString()
    };

    db.orders.push(newOrder);

    // Mark product as sold if it's direct-sale (not auction)
    const product = db.products.find(p => p.id === parseInt(productId));
    if (product && !product.isAuction) {
        product.sold = true;
    }

    saveDb();
    res.status(201).json(newOrder);
});

// Update order status (e.g. ship, release)
app.put('/api/orders/:id/status', (req, res) => {
    const { id } = req.params;
    const { status, trackingNumber, reviewed } = req.body;

    const order = db.orders.find(o => o.id === id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (status) order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (reviewed !== undefined) order.reviewed = reviewed;

    saveDb();
    res.json(order);
});

// Dispute resolution API (Real arbitration settlement)
app.put('/api/orders/:id/dispute-resolve', (req, res) => {
    const { id } = req.params;
    const { action } = req.body; // 'refund' (buyer gets money back) or 'release' (seller gets money)

    const order = db.orders.find(o => o.id === id);
    if (!order) return res.status(404).json({ message: "Pedido no encontrado" });

    if (order.status !== 'disputed') {
        return res.status(400).json({ message: "El pedido no está en disputa." });
    }

    if (action === 'refund') {
        // Refund Buyer
        const buyerUser = db.users.find(u => u.username.toLowerCase() === order.buyer.toLowerCase());
        if (buyerUser) {
            buyerUser.profileData.balance = parseFloat(buyerUser.profileData.balance) + parseFloat(order.price);
        }
        order.status = 'completed'; // resolve it as completed
        order.productTitle = `[REMBOLSADO - DISPUTA] ${order.productTitle}`;

        // Log transaction for buyer
        db.transactions.push({
            username: order.buyer,
            type: 'deposit',
            coin: order.coin,
            amount: order.price,
            usdValue: order.price,
            txHash: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
            timestamp: new Date().toISOString()
        });
    } else if (action === 'release') {
        // Release funds to Seller
        const sellerUser = db.users.find(u => u.username.toLowerCase() === order.seller.toLowerCase());
        if (sellerUser) {
            sellerUser.profileData.balance = parseFloat(sellerUser.profileData.balance) + parseFloat(order.price);
        }
        order.status = 'completed';

        // Log transaction for seller
        db.transactions.push({
            username: order.seller,
            type: 'deposit',
            coin: order.coin,
            amount: order.price,
            usdValue: order.price,
            txHash: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
            timestamp: new Date().toISOString()
        });
    } else {
        return res.status(400).json({ message: "Acción de arbitraje inválida." });
    }

    saveDb();
    res.json({ message: "Disputa arbitrada y resuelta con éxito.", order });
});

// =========================================================================
// TRANSACTIONS LEDGER API
// =========================================================================

// Log new transaction
app.post('/api/transactions', (req, res) => {
    const { username, type, coin, amount, usdValue, txHash } = req.body;
    if (!username || !type || !amount) {
        return res.status(400).json({ message: "Faltan campos obligatorios para la transacción." });
    }

    const newTx = {
        username,
        type,
        coin: coin || 'USDT',
        amount: parseFloat(amount),
        usdValue: parseFloat(usdValue || amount),
        txHash: txHash || '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        timestamp: new Date().toISOString()
    };

    db.transactions.push(newTx);
    saveDb();
    res.status(201).json(newTx);
});

// Get transaction history for user
app.get('/api/transactions/:username', (req, res) => {
    const { username } = req.params;
    const userTxs = db.transactions.filter(t => t.username.toLowerCase() === username.toLowerCase());
    res.json(userTxs);
});

// =========================================================================
// RATINGS & REVIEWS API
// =========================================================================

// Submit order review feedback
app.post('/api/reviews', (req, res) => {
    const { orderId, rating, comment, fromUser, toUser } = req.body;
    
    if (!orderId || !rating || !fromUser || !toUser) {
        return res.status(400).json({ message: "Faltan datos obligatorios para la valoración." });
    }

    // Record review
    const newReview = {
        id: db.reviews.length + 1,
        orderId,
        rating: parseInt(rating),
        comment: comment || "Sin comentarios.",
        fromUser,
        toUser,
        timestamp: new Date().toISOString()
    };

    db.reviews.push(newReview);

    // Update order status as reviewed
    const order = db.orders.find(o => o.id === orderId);
    if (order) {
        order.reviewed = true;
    }

    saveDb();
    res.status(201).json(newReview);
});

// Get reviews received by a user (computes rating dynamically)
app.get('/api/reviews/:username', (req, res) => {
    const { username } = req.params;
    const userReviews = db.reviews.filter(r => r.toUser.toLowerCase() === username.toLowerCase());
    
    const count = userReviews.length;
    let avg = "Sin puntuación";
    
    if (count > 0) {
        const sum = userReviews.reduce((acc, r) => acc + r.rating, 0);
        avg = (sum / count).toFixed(1);
    }

    res.json({
        username,
        averageRating: avg,
        reviewsCount: count,
        reviews: userReviews
    });
});

// =========================================================================
// CHATS API (P2P MSN Messages Pool)
// =========================================================================

// Get messages for a user
app.get('/api/chats/:username', (req, res) => {
    const { username } = req.params;
    const userChats = db.chats.filter(c => 
        c.from.toLowerCase() === username.toLowerCase() || 
        c.to.toLowerCase() === username.toLowerCase()
    );
    res.json(userChats);
});

// =========================================================================
// GROQ AI BOT RESPONDER INTEGRATION
// =========================================================================
const GROQ_API_KEYS = process.env.GROQ_API_KEYS
    ? process.env.GROQ_API_KEYS.split(',').map(k => k.trim()).filter(Boolean)
    : [];

// Fallback local rule-based responses
function getLocalBotResponse(botUser, userMessage, productTitle) {
    const to = botUser.username;
    const lowerText = userMessage.toLowerCase();
    
    if (lowerText.includes("zumbido") || userMessage === "[ZUMBIDO]") {
        return "¡Ay, perdón por el zumbido! Jaja, me dio nostalgia del MSN antiguo.";
    } else if (lowerText.includes("precio") || lowerText.includes("cuánto") || lowerText.includes("costo") || lowerText.includes("descuento") || lowerText.includes("dolares") || lowerText.includes("dólares")) {
        return "El precio es el publicado amigo, pero si me pagas rápido por Escrow te lo puedo dejar un poquito más barato.";
    } else if (lowerText.includes("envio") || lowerText.includes("despacho") || lowerText.includes("correo") || lowerText.includes("usps") || lowerText.includes("dirección") || lowerText.includes("enviar")) {
        return "Hago envíos al día siguiente por correo certificado. Pásame tu dirección cifrada con PGP para mayor seguridad.";
    } else if (lowerText.includes("usdt") || lowerText.includes("btc") || lowerText.includes("pago") || lowerText.includes("crypto") || lowerText.includes("escrow") || lowerText.includes("depositar")) {
        return "Sí, opero con USDT y saldo Kraken. Hacemos la transacción con depósito de garantía (Escrow) de la plataforma.";
    } else if (lowerText.includes("pgp") || lowerText.includes("clave") || lowerText.includes("firma")) {
        return "Mi clave pública PGP está en mi biografía. Asegúrate de cifrar todos tus datos confidenciales.";
    } else if (lowerText.includes("hola") || lowerText.includes("buenas") || lowerText.includes("que tal") || lowerText.includes("saludos")) {
        return `¡Hola! Qué gusto saludarte. Soy ${to}. ¿Te interesa alguno de mis artículos retro del Bazaar?`;
    } else {
        const botAnswers = [
            "Entendido. Encriptaré mi dirección de envío con PGP y te la paso en un momento.",
            "Perfecto! Avísame cuando registres el envío para estar atento al tracking.",
            "Hola amigo, ¿está todo probado y funcional? Me interesa ofertar.",
            "Hola, ya reviso la publicación y te aviso en breve. ¡Saludos!",
            "Me parece bien. Avísame si necesitas que libere los fondos del Escrow."
        ];
        return botAnswers[Math.floor(Math.random() * botAnswers.length)];
    }
}
// Build a bot's memory context dynamically from listings, orders, and chats
function getBotMemoryContext(botUser, otherUser) {
    if (!botUser) return "";
    const username = botUser.username;
    
    // 1. Listings
    const myProducts = db.products.filter(p => p.seller.toLowerCase() === username.toLowerCase());
    const listingsText = myProducts.length > 0 
        ? myProducts.map(p => `- "${p.title}" por $${p.price} USD (${p.isAuction ? 'Subasta' : 'Venta directa'}${p.sold ? ' - VENDIDO' : ''})`).join('\n')
        : 'No tienes ningún artículo publicado actualmente.';

    // 2. Orders/Transactions
    const myOrders = db.orders.filter(o => 
        o.buyer.toLowerCase() === username.toLowerCase() || 
        o.seller.toLowerCase() === username.toLowerCase()
    );
    const ordersText = myOrders.length > 0
        ? myOrders.map(o => {
            const role = o.buyer.toLowerCase() === username.toLowerCase() ? 'Comprador' : 'Vendedor';
            return `- Pedido ${o.id}: "${o.productTitle}" por $${o.price} USD. Rol: ${role}. Estado: ${o.status}.`;
        }).join('\n')
        : 'No tienes pedidos ni transacciones registradas.';

    // 3. Chat history with this specific user
    let chatText = 'No hay mensajes previos.';
    if (otherUser) {
        const myChats = db.chats.filter(c => 
            (c.from && c.from.toLowerCase() === username.toLowerCase() && c.to && c.to.toLowerCase() === otherUser.toLowerCase()) ||
            (c.from && c.from.toLowerCase() === otherUser.toLowerCase() && c.to && c.to.toLowerCase() === username.toLowerCase())
        );
        if (myChats.length > 0) {
            const lastChats = myChats.slice(-15);
            chatText = lastChats.map(c => `[${c.from} -> ${c.to}] (${c.timestamp ? new Date(c.timestamp).toLocaleTimeString() : ''}): ${c.text}`).join('\n');
        }
    }

    return `
=== MEMORIA Y CONTEXTO DE TU CUENTA (DATOS REALES) ===
Tus artículos publicados:
${listingsText}

Tus transacciones y pedidos:
${ordersText}

Historial de chat con ${otherUser || 'el usuario'}:
${chatText}
=====================================================
`;
}

// Generate response via Groq API (llama-3.1-8b-instant) with rotating keys and fallback
async function generateGroqResponse(botUser, userMessage, productTitle, otherUsername) {
    const to = botUser.username;
    
    // Check if it's a zumbido - keep the fast-path for the nudge sound effect
    if (userMessage === "[ZUMBIDO]") {
        return "¡Ay, perdón por el zumbido! Jaja, me dio nostalgia del MSN antiguo.";
    }

    const memoryContext = getBotMemoryContext(botUser, otherUsername);

    const systemPrompt = `
Eres un usuario real de una comunidad retro y cyber-bazar chateando por MSN Messenger en el año 2000.
Tu apodo/usuario de chat es: "${to}"
Tu biografía/personalidad es: "${botUser.profileData?.bio || ''}"
Tu ubicación es: "${botUser.profileData?.location || ''}"

${memoryContext}

Instrucciones imperativas de estilo:
1. Responde en español de forma casual, informal y directa.
2. Usa modismos y jerga de chat clásica de MSN del año 2000 (como risas "jaja" o "jajaja", abreviaciones de chat como "tmb", "dnd", "q", "tb", "ok", "x", o emoticonos clásicos de texto como :-) o :-P).
3. Mantén tus respuestas extremadamente cortas y breves (de 1 a 3 oraciones como máximo). No te extiendas con explicaciones largas.
4. Ten en cuenta tu MEMORIA Y CONTEXTO de arriba. Si el usuario te pregunta sobre un artículo que vendes, un pedido, o un historial, consulta tu memoria para responder con datos 100% reales.
5. Adáptate estrictamente a tu personalidad (ej. si eres "matrix_hacker" habla sobre encriptación y claves PGP; si eres "retro_gamer" habla de jugar Quake, Doom o hardware retro).
`;

    for (let i = 0; i < GROQ_API_KEYS.length; i++) {
        const apiKey = GROQ_API_KEYS[i];
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userMessage }
                    ],
                    temperature: 0.7,
                    max_tokens: 150
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    const text = data.choices[0].message.content.trim();
                    return text.replace(/^"|"$/g, '').trim(); // clean quotes if any
                }
            } else {
                console.error(`[GROQ API] Error responding with key ${i + 1}: status ${response.status}`);
            }
        } catch (err) {
            console.error(`[GROQ API] Exception with key ${i + 1}:`, err.message);
        }
    }

    console.log(`[GROQ API] Fallback a respuesta por reglas locales para ${to}`);
    return getLocalBotResponse(botUser, userMessage, productTitle);
}

// Post a chat message
app.post('/api/chats', (req, res) => {
    const { from, to, text, productTitle, productId } = req.body;
    if (!from || !to || !text) {
        return res.status(400).json({ message: "Missing sender, recipient or text" });
    }

    const newMsg = {
        id: db.chats.length + 1,
        from,
        to,
        text,
        productTitle: productTitle || null,
        productId: productId || null,
        timestamp: new Date().toISOString()
    };

    db.chats.push(newMsg);
    saveDb();

    // Check if recipient is a bot to auto-respond
    const isBotRecipient = botsList.some(b => b.username.toLowerCase() === to.toLowerCase());
    if (isBotRecipient) {
        const botUser = botsList.find(b => b.username.toLowerCase() === to.toLowerCase());
        
        generateGroqResponse(botUser, text, productTitle, from)
            .then(botAnswerText => {
                setTimeout(() => {
                    const botMsg = {
                        id: db.chats.length + 1,
                        from: to, // the bot
                        to: from, // the human
                        text: botAnswerText,
                        productTitle: productTitle || null,
                        productId: productId || null,
                        timestamp: new Date().toISOString()
                    };
                    db.chats.push(botMsg);
                    saveDb();
                    console.log(`[BOT ENGINE] Respuesta automática del bot ${to} a ${from}: "${botAnswerText}"`);
                }, 3000);
            })
            .catch(err => {
                console.error(`[BOT ENGINE] Error al generar respuesta del bot ${to}:`, err);
            });
    }

    res.status(201).json(newMsg);
});

// =========================================================================
// AUCTIONS & FORUM API
// =========================================================================

// Place a bid on an auction product
app.post('/api/products/:id/bid', (req, res) => {
    const id = parseInt(req.params.id);
    const { bidder, bidAmount } = req.body;

    if (!bidder || !bidAmount) {
        return res.status(400).json({ message: "Falta el postor o la cantidad de la oferta." });
    }

    const product = db.products.find(p => p.id === id);
    if (!product) return res.status(404).json({ message: "Producto no encontrado." });

    if (!product.isAuction) {
        return res.status(400).json({ message: "Este artículo no se vende mediante subasta." });
    }

    const now = new Date();
    if (product.auctionEnd && new Date(product.auctionEnd) < now || product.auctionFinalized) {
        return res.status(400).json({ message: "Esta subasta ya ha finalizado o expirado." });
    }

    const minBid = product.highestBidder ? product.price + 1.00 : product.price;
    if (parseFloat(bidAmount) < minBid) {
        return res.status(400).json({ message: `La oferta debe ser de al menos $${minBid.toFixed(2)} USD.` });
    }

    // Check bidder balance
    const bidderUser = db.users.find(u => u.username.toLowerCase() === bidder.toLowerCase());
    if (!bidderUser) return res.status(404).json({ message: "Usuario postor no encontrado." });

    if (bidderUser.profileData.balance < parseFloat(bidAmount)) {
        return res.status(400).json({ message: "Saldo insuficiente para realizar esta oferta." });
    }

    // Refund previous bidder if exists
    if (product.highestBidder) {
        const prevBidder = db.users.find(u => u.username.toLowerCase() === product.highestBidder.toLowerCase());
        if (prevBidder) {
            prevBidder.profileData.balance = parseFloat(prevBidder.profileData.balance) + parseFloat(product.price);
            
            // Log transaction for previous bidder refund
            db.transactions.push({
                username: prevBidder.username,
                type: 'deposit',
                coin: 'USDT',
                amount: product.price,
                usdValue: product.price,
                txHash: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
                timestamp: new Date().toISOString()
            });
        }
    }

    // Deduct money from new bidder
    bidderUser.profileData.balance = parseFloat(bidderUser.profileData.balance) - parseFloat(bidAmount);
    
    // Log transaction for new bidder (locked bid)
    db.transactions.push({
        username: bidderUser.username,
        type: 'withdrawal',
        coin: 'USDT',
        amount: parseFloat(bidAmount),
        usdValue: parseFloat(bidAmount),
        txHash: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        timestamp: new Date().toISOString()
    });

    // Update product details
    product.price = parseFloat(bidAmount);
    product.highestBidder = bidderUser.username;
    
    saveDb();
    res.json({ message: "Oferta realizada con éxito.", product });
});

// Get all forum threads
app.get('/api/forum/threads', (req, res) => {
    res.json(db.threads || []);
});

// Create forum thread
app.post('/api/forum/threads', (req, res) => {
    const { category, title, author, content } = req.body;
    if (!category || !title || !author || !content) {
        return res.status(400).json({ message: "Faltan campos obligatorios para el hilo." });
    }
    const newThread = {
        id: db.nextThreadId++,
        category,
        title,
        author,
        content,
        replies: [],
        timestamp: new Date().toISOString()
    };
    db.threads = db.threads || [];
    db.threads.push(newThread);
    saveDb();
    res.status(201).json(newThread);
});

// Post a reply to forum thread
app.post('/api/forum/threads/:id/replies', (req, res) => {
    const id = parseInt(req.params.id);
    const { author, content } = req.body;
    if (!author || !content) {
        return res.status(400).json({ message: "Faltan campos obligatorios para la respuesta." });
    }
    db.threads = db.threads || [];
    const thread = db.threads.find(t => t.id === id);
    if (!thread) return res.status(404).json({ message: "Hilo no encontrado" });
    
    const newReply = {
        author,
        content,
        timestamp: new Date().toISOString()
    };
    thread.replies = thread.replies || [];
    thread.replies.push(newReply);
    saveDb();
    res.status(201).json(newReply);
});

// =========================================================================
// AUTONOMOUS BOT ACTIVITY ENGINE
// =========================================================================

const botsList = [
    {
        username: 'matrix_hacker',
        password: 'botpassword123',
        email: 'matrix_hacker@kraken.onion',
        profileData: {
            location: 'Zion Core',
            bio: 'Verificando firmas PGP y descifrando bloques. Solo uso claves fuertes.',
            avatar: '😎',
            storeName: 'Matrix Crypto Gear',
            balance: 0.00
        }
    },
    {
        username: 'retro_collector',
        password: 'botpassword123',
        email: 'retro_collector@kraken.onion',
        profileData: {
            location: 'Tokio, Japón',
            bio: 'Buscando hardware retro de los 90 y principios de los 2000. Pago rápido.',
            avatar: '💾',
            storeName: 'Retro Silicon Depot',
            balance: 0.00
        }
    },
    {
        username: 'pgp_pioneer',
        password: 'botpassword123',
        email: 'pgp_pioneer@kraken.onion',
        profileData: {
            location: 'Suiza',
            bio: 'Arquitecto de privacidad. Promoviendo el uso de PGP para toda comunicación.',
            avatar: '🔒',
            storeName: 'Pioneer Cryptography',
            balance: 0.00
        }
    },
    {
        username: 'dialup_surfer',
        password: 'botpassword123',
        email: 'dialup_surfer@kraken.onion',
        profileData: {
            location: 'California, EE.UU.',
            bio: 'Navegando a 56kbps. Colecciono manuales de Netscape y CDs de AOL.',
            avatar: '🏄',
            storeName: 'Surfer Dial-up Outlet',
            balance: 0.00
        }
    },
    {
        username: 'cyber_punk',
        password: 'botpassword123',
        email: 'cyber_punk@kraken.onion',
        profileData: {
            location: 'Neo-Tokyo',
            bio: 'Buscando piezas raras para mi terminal retro. Solo cifrado PGP de alta seguridad.',
            avatar: '🦾',
            storeName: 'Cyberpunk RetroParts',
            balance: 0.00
        }
    },
    {
        username: 'win98_expert',
        password: 'botpassword123',
        email: 'win98_expert@kraken.onion',
        profileData: {
            location: 'Berlín, Alemania',
            bio: 'Restaurando PCs retro de finales de los 90. Busco placas madre Socket 7 y tarjetas de red ISA.',
            avatar: '🖥️',
            storeName: 'Win98 Silicon Lab',
            balance: 0.00
        }
    },
    {
        username: 'netscape_surfer',
        password: 'botpassword123',
        email: 'netscape_surfer@kraken.onion',
        profileData: {
            location: 'Seattle, EE.UU.',
            bio: 'Cargando el navegador Netscape Navigator... Añorando los días de la Web 1.0.',
            avatar: '🌐',
            storeName: 'Surfer Web Directory',
            balance: 0.00
        }
    },
    {
        username: 'onion_dealer',
        password: 'botpassword123',
        email: 'onion_dealer@kraken.onion',
        profileData: {
            location: 'Escondido en la Red',
            bio: 'Vendedor de seguridad y enrutadores cebolla. Compra segura 100% garantizada por depósito.',
            avatar: '🧅',
            storeName: 'The Onion Secure Shop',
            balance: 0.00
        }
    },
    {
        username: 'retro_gamer',
        password: 'botpassword123',
        email: 'retro_gamer@kraken.onion',
        profileData: {
            location: 'Texas, EE.UU.',
            bio: 'Jugador de Quake y Doom. Busco tarjetas de sonido Sound Blaster y GPUs Voodoo.',
            avatar: '🎮',
            storeName: 'Classic Games & Hardware',
            balance: 0.00
        }
    },
    {
        username: 'pgp_guru',
        password: 'botpassword123',
        email: 'pgp_guru@kraken.onion',
        profileData: {
            location: 'Helsinki, Finlandia',
            bio: 'Cifrando el mundo un bloque a la vez. Verifico todas las claves y firmas.',
            avatar: '🔑',
            storeName: 'Secure Cryptography Node',
            balance: 0.00
        }
    },
    {
        username: 'floppy_collector',
        password: 'botpassword123',
        email: 'floppy_collector@kraken.onion',
        profileData: {
            location: 'Londres, Reino Unido',
            bio: 'Colecciono disquetes de 3.5 y 5.25 pulgadas. Compro juegos retro en caja grande.',
            avatar: '💾',
            storeName: 'Floppy Disk Depot',
            balance: 0.00
        }
    },
    {
        username: 'coaxial_expert',
        password: 'botpassword123',
        email: 'coaxial_expert@kraken.onion',
        profileData: {
            location: 'París, Francia',
            bio: 'Especialista en redes coaxiales del siglo pasado. Cableado y hubs ethernet antiguos.',
            avatar: '🔌',
            storeName: 'Coaxial Network Supply',
            balance: 0.00
        }
    },
    {
        username: 'voodoo_master',
        password: 'botpassword123',
        email: 'voodoo_master@kraken.onion',
        profileData: {
            location: 'Austin, Texas',
            bio: '¡Jugando Unreal Tournament en mi Voodoo 3! Busco tarjetas Voodoo 5 y placas base Slot 1.',
            avatar: '🎮',
            storeName: 'Voodoo Hardware Lab',
            balance: 0.00
        }
    },
    {
        username: 'mp3_hoarder',
        password: 'botpassword123',
        email: 'mp3_hoarder@kraken.onion',
        profileData: {
            location: 'Londres, Reino Unido',
            bio: 'Coleccionando archivos MP3 de finales de los 90. Busco reproductores Rio y discos duros grandes.',
            avatar: '🎶',
            storeName: 'Y2K Audio & Media',
            balance: 0.00
        }
    },
    {
        username: 'irc_op',
        password: 'botpassword123',
        email: 'irc_op@kraken.onion',
        profileData: {
            location: 'Helsinki, Finlandia',
            bio: 'Operador de IRC en Undernet. Siempre activo en el foro. Uso PGP para todas mis conversaciones.',
            avatar: '💬',
            storeName: 'IRC Secure Hub',
            balance: 0.00
        }
    },
    {
        username: 'bios_flash',
        password: 'botpassword123',
        email: 'bios_flash@kraken.onion',
        profileData: {
            location: 'Silicon Valley, EE.UU.',
            bio: 'Programador de BIOS y restaurador de placas antiguas. Busco programadores EEPROM.',
            avatar: '🛠️',
            storeName: 'EEPROM & BIOS Outlet',
            balance: 0.00
        }
    },
    {
        username: 'amiga_fanatic',
        password: 'botpassword123',
        email: 'amiga_fanatic@kraken.onion',
        profileData: {
            location: 'Berlín, Alemania',
            bio: 'Amante de Commodore Amiga. Busco aceleradoras, disquetes y manuales retro.',
            avatar: '🖥️',
            storeName: 'Amiga Silicon Depot',
            balance: 0.00
        }
    },
    {
        username: 'soundblaster_guy',
        password: 'botpassword123',
        email: 'soundblaster_guy@kraken.onion',
        profileData: {
            location: 'París, Francia',
            bio: 'Coleccionista de tarjetas Sound Blaster 16 y AWE64. Compro sintetizadores MIDI.',
            avatar: '🎹',
            storeName: 'SoundBlaster Guy Store',
            balance: 0.00
        }
    }
];

function registerBotsIfNotExist() {
    let dbChanged = false;
    botsList.forEach(bot => {
        const exists = db.users.some(u => u.username.toLowerCase() === bot.username.toLowerCase());
        if (!exists) {
            db.users.push(bot);
            dbChanged = true;
        }
    });
    if (dbChanged) {
        saveDb();
    }
}

function botDeposit(botUsername, amount) {
    const user = db.users.find(u => u.username.toLowerCase() === botUsername.toLowerCase());
    if (!user) return;

    user.profileData.balance = parseFloat(user.profileData.balance) + parseFloat(amount);
    
    // Log transaction
    db.transactions.push({
        username: user.username,
        type: 'deposit',
        coin: 'USDT',
        amount: parseFloat(amount),
        usdValue: parseFloat(amount),
        txHash: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        timestamp: new Date().toISOString()
    });
    
    console.log(`[BOT ENGINE] Depósito simulado de $${amount} USD para el bot: ${user.username}`);
}

const botProductPool = [
    { title: 'Placa Voodoo 3 3000 AGP 16MB', price: 75.00, icon: '💿', condition: 'Usado - Buen Estado', desc: 'Tarjeta de video clásica para jugar Unreal Tournament y Quake III. Funciona al 100%.' },
    { title: 'Módem Externo USRobotics 56k', price: 35.00, icon: '📼', condition: 'Nuevo', desc: 'Módem para conexión dial-up. Incluye cables RJ11 originales y fuente de alimentación.' },
    { title: 'Disquetera Zip Iomega 100MB Externa', price: 90.00, icon: '💾', condition: 'Usado - Como Nuevo', desc: 'Lector de discos Zip para almacenamiento masivo. Excelente estado estético y funcional.' },
    { title: 'Manual de Criptografía Aplicada PGP 6.5', price: 25.00, icon: '🔒', condition: 'Nuevo', desc: 'Libro impreso original explicando el cifrado RSA y claves simétricas. Ideal para amantes de la privacidad.' },
    { title: 'CD Original Windows 98 Segunda Edición', price: 15.00, icon: '💿', condition: 'Nuevo', desc: 'CD sellado con clave de licencia original. Para coleccionistas de sistemas operativos retro.' },
    { title: 'Tarjeta de Red ISA Coaxial NE2000', price: 20.00, icon: '🔌', condition: 'Usado - Aceptable', desc: 'Tarjeta de red clásica de 10Mbps. Conector BNC coaxial. Probada y funcional.' },
    { title: 'Procesador Intel Pentium III 800MHz', price: 45.00, icon: '⚡', condition: 'Nuevo', desc: 'Procesador Slot 1 clásico para placas de finales de los 90. En su caja original sin abrir.' },
    { title: 'Auriculares Retro tipo diadema Y2K', price: 18.00, icon: '🎧', condition: 'Nuevo', desc: 'Auriculares de espuma naranja ultra delgados. Estética Y2K retro de los años 2000.' },
    { title: 'Teclado Mecánico IBM Model M Space Saving', price: 160.00, icon: '⌨️', condition: 'Usado - Excelente', desc: 'El rey de los teclados. Conector PS/2, clicky táctil impresionante. Hecho en 1993.' }
];

const botForumThreads = [
    { category: 'security', title: '¿Sigue siendo seguro el cifrado RSA de 1024 bits?', content: 'He visto que algunos recomiendan migrar a 2048 o 4096 bits para llaves PGP. ¿Creen que los nodos del gobierno ya puedan romper 1024?' },
    { category: 'arbitrage', title: 'Recomendación del árbitro ArbiterNode_Kraken', content: 'Tuve un problema con un envío que llegó roto y el árbitro resolvió de manera justa reembolsándome los fondos en 24 horas. ¡Excelente soporte de la plataforma!' },
    { category: 'scammers', title: 'Alerta de estafa con el vendedor L33tBroker', content: 'Cuidado al comprarle tarjetas ISA, envía disquetes vacíos en su lugar. Ya abrí una disputa de Escrow. Manténganse alejados.' }
];

const botForumReplies = [
    { category: 'security', replies: [
        'Totalmente recomendado migrar a 4096. RSA 1024 ya es vulnerable a ataques de fuerza bruta por supercomputadores.',
        'Yo uso llaves PGP de 2048 bits para mis chats en MSN y firmar mis transacciones, me parece el equilibrio perfecto.',
        'La privacidad no es negociable, usen siempre cifrado fuerte y no confíen en claves por defecto.'
    ]},
    { category: 'arbitrage', replies: [
        'Sí, el sistema de Escrow de Kraken es lo que lo hace confiable.',
        'Gracias por el reporte, es bueno saber qué árbitros son imparciales.',
        'Es fundamental usar siempre el depósito de garantía en todas las compras.'
    ]},
    { category: 'scammers', replies: [
        'Gracias por avisar. Lo añadiré a mi lista negra local.',
        'Qué bueno que usaste Escrow, de lo contrario habrías perdido tus USDT.',
        'Reporten su nodo de red para que sea bloqueado del diagnóstico.'
    ]}
];

const botChatMessages = [
    'Hola! ¿El artículo sigue disponible para envío?',
    'Buenas, aceptás pagos en USDT?',
    'Hola! Ya realicé la compra, ¿cuándo podrías hacer el despacho?',
    'Qué tal amigo, ¿hacés envíos internacionales?',
    'Hola, te acabo de liberar los fondos del Escrow. ¡Gracias por el producto!',
    '¿El módem de 56k viene en su caja original?',
    'Hola, te mandé la dirección cifrada con PGP al inbox.',
    'Hola, ¿aceptas ofertas por el teclado IBM?'
];

// Helper function to query Groq LLM with key rotation and fallback
async function generateAiText(systemPrompt, userPrompt, fallbackText) {
    for (let i = 0; i < GROQ_API_KEYS.length; i++) {
        const apiKey = GROQ_API_KEYS[i];
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 150
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    const text = data.choices[0].message.content.trim();
                    return text.replace(/^"|"$/g, '').trim();
                }
            }
        } catch (err) {
            console.error(`[GROQ API] Exception in generateAiText with key ${i + 1}:`, err.message);
        }
    }
    return fallbackText;
}

// Generate Y2K MSN message upon purchase
async function generateBotPurchaseMessage(botUser, productTitle, price, otherUsername) {
    if (!botUser) return `¡Hola! Acabo de comprar tu artículo "${productTitle}" por $${price} USD a través de Escrow. Por favor, realiza el envío y registra el número de seguimiento para poder rastrearlo. ¡Gracias!`;
    const memoryContext = getBotMemoryContext(botUser, otherUsername);
    const systemPrompt = `
Eres un usuario real de una comunidad retro y cyber-bazar chateando por MSN Messenger en el año 2000.
Tu apodo/usuario es: "${botUser.username || 'Usuario Retro'}"
Tu biografía/personalidad es: "${botUser.profileData?.bio || ''}"
Tu ubicación es: "${botUser.profileData?.location || ''}"

${memoryContext}

Instrucciones imperativas de estilo:
1. Responde en español de forma casual, informal y directa.
2. Usa modismos y jerga de chat clásica de MSN del año 2000 (como risas "jaja", abreviaciones como "tmb", "dnd", "q", emoticonos de texto clásico como :-) o :-P).
3. Mantén tus respuestas extremadamente cortas (1 a 3 oraciones como máximo).
4. Adáptate estrictamente a tu personalidad.
5. Ten en cuenta tu MEMORIA Y CONTEXTO de arriba para estar 100% al tanto de lo que haces, publicas y dices.
`;
    const userPrompt = `Acabas de comprar el producto "${productTitle}" por $${price} USD a través del sistema de depósito de garantía (Escrow) del Bazaar. Escríbele un mensaje al vendedor (que es ${otherUsername}) para notificarle de tu compra y pídele amablemente que envíe el paquete y registre el número de seguimiento.`;
    const fallbackText = `¡Hola! Acabo de comprar tu artículo "${productTitle}" por $${price} USD a través de Escrow. Por favor, realiza el envío y registra el número de seguimiento para poder rastrearlo. ¡Gracias!`;
    
    return generateAiText(systemPrompt, userPrompt, fallbackText);
}

// Generate Y2K MSN message upon Escrow completion
async function generateBotCompletionMessage(botUser, productTitle, otherUsername) {
    if (!botUser) return `¡Hola! Ya recibí el paquete de "${productTitle}" en perfectas condiciones. Acabo de liberar los fondos del Escrow y te he dejado una valoración de 5 estrellas. ¡Muchas gracias!`;
    const memoryContext = getBotMemoryContext(botUser, otherUsername);
    const systemPrompt = `
Eres un usuario real chateando por MSN Messenger en el año 2000.
Tu apodo/usuario es: "${botUser.username || 'Usuario Retro'}"
Tu biografía/personalidad es: "${botUser.profileData?.bio || ''}"
Tu ubicación es: "${botUser.profileData?.location || ''}"

${memoryContext}

Instrucciones de estilo:
1. Responde en español de forma casual, informal y directa.
2. Usa modismos y jerga de chat clásica de MSN (abreviaciones "tmb", "q", emoticonos :-) o :-D).
3. Mantén tus respuestas cortas (1 a 3 oraciones).
4. Adáptate estrictamente a tu personalidad.
5. Ten en cuenta tu MEMORIA Y CONTEXTO de arriba para estar 100% al tanto de lo que haces, publicas y dices.
`;
    const userPrompt = `Has recibido el paquete del artículo "${productTitle}" en perfectas condiciones y has liberado los fondos de Escrow al vendedor (que es ${otherUsername}). Escríbele un mensaje corto para avisarle y agradecerle por la transacción.`;
    const fallbackText = `¡Hola! Ya recibí el paquete de "${productTitle}" en perfectas condiciones. Acabo de liberar los fondos del Escrow y te he dejado una valoración de 5 estrellas. ¡Muchas gracias!`;
    
    return generateAiText(systemPrompt, userPrompt, fallbackText);
}

// Generate 5-star review comment
async function generateBotReviewComment(botUser, productTitle, otherUsername) {
    if (!botUser) return `¡Excelente vendedor! Envío muy rápido y el artículo "${productTitle}" está tal como se describió. Recomendado 100%.`;
    const memoryContext = getBotMemoryContext(botUser, otherUsername);
    const systemPrompt = `
Eres un comprador dejando una reseña en un sitio de comercio electrónico retro en el año 2000.
Tu apodo/usuario es: "${botUser.username || 'Usuario Retro'}"
Tu biografía/personalidad es: "${botUser.profileData?.bio || ''}"

${memoryContext}

Instrucciones de estilo:
1. Responde en español de forma casual.
2. Escribe una valoración positiva de 5 estrellas extremadamente corta (1 o 2 oraciones como máximo).
3. Adáptate estrictamente a tu personalidad.
4. Ten en cuenta tu MEMORIA Y CONTEXTO de arriba para estar 100% al tanto de lo que haces, publicas y dices.
`;
    const userPrompt = `Escribe un comentario de valoración de 5 estrellas sobre tu compra del artículo "${productTitle}" al vendedor ${otherUsername}.`;
    const fallbackText = `¡Excelente vendedor! Envío muy rápido y el artículo "${productTitle}" está tal como se describió. Recomendado 100%.`;
    
    return generateAiText(systemPrompt, userPrompt, fallbackText);
}

// Generate proactive MSN question message
async function generateBotProactiveMessage(botUser, productTitle, otherUsername) {
    if (!botUser) return `Hola! Me interesa tu artículo "${productTitle}". ¿Está todo probado y funcional? ¿Aceptas alguna oferta o precio final por Escrow?`;
    const memoryContext = getBotMemoryContext(botUser, otherUsername);
    const systemPrompt = `
Eres un usuario real de una comunidad retro y cyber-bazar chateando por MSN Messenger en el año 2000.
Tu apodo/usuario es: "${botUser.username || 'Usuario Retro'}"
Tu biografía/personalidad es: "${botUser.profileData?.bio || ''}"
Tu ubicación es: "${botUser.profileData?.location || ''}"

${memoryContext}

Instrucciones de estilo:
1. Responde en español de forma casual, informal y directa.
2. Usa modismos y jerga de chat clásica de MSN del año 2000 (jaja, abreviaciones tmb, q, dnd, emoticonos :-) o :-P).
3. Escribe un mensaje de apertura corto (1 a 2 oraciones) mostrando interés en el producto "${productTitle}". Pídele detalles sobre su funcionamiento, si tiene algún detalle estético o si acepta ofertas al vendedor ${otherUsername}.
4. Adáptate estrictamente a tu personalidad retro/Y2K.
5. Ten en cuenta tu MEMORIA Y CONTEXTO de arriba para estar 100% al tanto de lo que haces, publicas y dices.
`;
    const userPrompt = `Escribe una pregunta para hacerle al vendedor ${otherUsername} sobre su artículo en venta "${productTitle}".`;
    const fallbackText = `Hola! Me interesa tu artículo "${productTitle}". ¿Está todo probado y funcional? ¿Aceptas alguna oferta o precio final por Escrow?`;
    
    return generateAiText(systemPrompt, userPrompt, fallbackText);
}

// =========================================================================
// RETRO TECH DYNAMIC IMAGE RESOLVER
// =========================================================================
const retroImages = {
    computer: "https://images.unsplash.com/photo-1551645121-d1034da75057?w=300&auto=format&fit=crop",
    disk: "https://images.unsplash.com/photo-1599666505327-7758b44a9985?w=300&auto=format&fit=crop",
    keyboard: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=300&auto=format&fit=crop",
    tape: "https://images.unsplash.com/photo-1532244769018-9b3484f762f9?w=300&auto=format&fit=crop",
    gamepad: "https://images.unsplash.com/photo-1531525645387-7f14be1bdbbd?w=300&auto=format&fit=crop",
    circuit: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&auto=format&fit=crop",
    phone: "https://images.unsplash.com/photo-1520923642038-b4a53cb6ca68?w=300&auto=format&fit=crop",
    mouse: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=300&auto=format&fit=crop",
    monitor: "https://images.unsplash.com/photo-1547082299-de196ea013d6?w=300&auto=format&fit=crop",
    generic: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300&auto=format&fit=crop"
};

function getRetroImageUrl(title, category) {
    const text = ((title || "") + " " + (category || "")).toLowerCase();
    if (text.includes("disquete") || text.includes("disk") || text.includes("zip") || text.includes("floppy")) {
        return retroImages.disk;
    } else if (text.includes("teclado") || text.includes("keyboard") || text.includes("ibm model")) {
        return retroImages.keyboard;
    } else if (text.includes("auriculares") || text.includes("casete") || text.includes("tape") || text.includes("cinta") || text.includes("sound blaster")) {
        return retroImages.tape;
    } else if (text.includes("voodoo") || text.includes("tarjeta") || text.includes("procesador") || text.includes("slot") || text.includes("motherboard") || text.includes("card") || text.includes("isa") || text.includes("pci")) {
        return retroImages.circuit;
    } else if (text.includes("game") || text.includes("playstation") || text.includes("atari") || text.includes("nintendo") || text.includes("joystick") || text.includes("juego")) {
        return retroImages.gamepad;
    } else if (text.includes("módem") || text.includes("modem") || text.includes("teléfono") || text.includes("phone")) {
        return retroImages.phone;
    } else if (text.includes("mouse") || text.includes("ratón")) {
        return retroImages.mouse;
    } else if (text.includes("monitor") || text.includes("pantalla") || text.includes("crt") || text.includes("tv")) {
        return retroImages.monitor;
    } else if (text.includes("computadora") || text.includes("pc") || text.includes("ordenador")) {
        return retroImages.computer;
    }
    return retroImages.generic;
}

function parseJsonFromLlm(text) {
    if (!text) return null;
    let clean = text.trim();
    if (clean.startsWith("```")) {
        clean = clean.replace(/^```(json)?/, "").replace(/```$/, "").trim();
    }
    try {
        return JSON.parse(clean);
    } catch (e) {
        console.warn("[JSON PARSER] Failed to parse JSON:", e.message, "Text:", text);
        return null;
    }
}

async function generateBotProduct(botUser) {
    if (!botUser) return null;
    const systemPrompt = `Eres un usuario real de una comunidad retro y cyber-bazar en el año 2000.
Tu apodo/usuario es: "${botUser.username}"
Tu biografía/personalidad es: "${botUser.profileData?.bio || ''}"
Tu ubicación es: "${botUser.profileData?.location || ''}"

Instrucciones imperativas:
1. Inventa un artículo tecnológico retro del año 2000 o antes que sea muy afín con tu personalidad e intereses para vender en el bazaar.
2. Devuelve ÚNICAMENTE un objeto JSON válido con los siguientes campos exactos (sin explicaciones, sin markdown, solo el JSON raw):
{
  "title": "nombre corto del producto (ej: Tarjeta de Video Voodoo 3)",
  "desc": "descripción llamativa y detallada al estilo de los años 90/2000",
  "price": precio del producto en USD (número decimal realista entre 5 y 200),
  "category": "categoría del producto (puedes crear una categoría especial y descriptiva como 'Hardware ISA', 'Modems', 'Criptografía', 'Software', 'Vintage Gaming', etc.)",
  "condition": "Nuevo", "Usado - Buen Estado", o "Usado - Como Nuevo",
  "icon": "un emoji único y apropiado para el artículo (ej: 💾, 💿, 📟, 🔌, 📼, ⌨️, ⚡)"
}`;
    const userPrompt = "Genera los detalles de un producto retro único que deseas vender en el bazaar en formato JSON.";
    const responseText = await generateAiText(systemPrompt, userPrompt, "");
    return parseJsonFromLlm(responseText);
}

async function generateBotForumThread(botUser) {
    if (!botUser) return null;
    const systemPrompt = `Eres un usuario real de una comunidad y cyber-bazar participando en el foro estilo phpBB en el año 2000.
Tu apodo/usuario es: "${botUser.username}"
Tu biografía/personalidad es: "${botUser.profileData?.bio || ''}"

Instrucciones imperativas:
1. Crea un nuevo hilo de discusión para el foro. Debe tratar sobre algún tema retro, cyberpunk, hardware clásico, quejas de estafas, dudas de seguridad PGP, o conspiraciones del efecto Y2K, alineado fuertemente con tus intereses.
2. Devuelve ÚNICAMENTE un objeto JSON válido con los siguientes campos exactos:
{
  "category": "security", "arbitrage", o "scammers",
  "title": "título corto y llamativo del hilo",
  "content": "contenido del hilo, redactado de forma natural, informal y muy realista"
}`;
    const userPrompt = "Genera un nuevo hilo de discusión en formato JSON.";
    const responseText = await generateAiText(systemPrompt, userPrompt, "");
    return parseJsonFromLlm(responseText);
}

async function generateBotForumReply(botUser, thread) {
    if (!botUser || !thread) return "";
    const systemPrompt = `Eres un usuario real respondiendo a un hilo de discusión en un foro estilo phpBB en el año 2000.
Tu apodo/usuario es: "${botUser.username}"
Tu biografía/personalidad es: "${botUser.profileData?.bio || ''}"

Aquí están los detalles del hilo:
Autor: ${thread.author}
Título: "${thread.title}"
Contenido original: "${thread.content}"
Respuestas previas:
${(thread.replies || []).slice(-5).map(r => `- ${r.author}: ${r.content}`).join('\n')}

Instrucciones:
1. Escribe una respuesta corta y natural en español (1 a 3 oraciones como máximo).
2. Adáptate estrictamente a tu personalidad (bio) y al tema del hilo.
3. No saludes formalmente. Sé informal, directo y muy humano.
4. Devuelve ÚNICAMENTE tu respuesta como texto plano, sin formato adicional y sin comillas.`;
    const userPrompt = "Escribe tu respuesta al hilo.";
    return generateAiText(systemPrompt, userPrompt, "Interesante tema, gracias por compartir.");
}

function ensureDbConsistency() {
    let changed = false;
    db.products.forEach(p => {
        if (!p.sold && !p.isAuction) {
            // Check if there is an order for this product ID
            const hasFundedOrCompletedOrder = db.orders.some(o => 
                o.productId === p.id && 
                (o.status === 'funded' || o.status === 'shipped' || o.status === 'completed')
            );
            if (hasFundedOrCompletedOrder) {
                p.sold = true;
                changed = true;
                console.log(`[DB CONSISTENCY] Marcando producto ${p.id} ("${p.title}") como vendido (detectado en órdenes).`);
            }
        }
    });
    if (changed) {
        saveDb();
    }
}

async function generateBotInterestMessage(botUser, productTitle, otherUsername) {
    if (!botUser) return `¡Hola! Me interesa mucho tu artículo "${productTitle}". ¿Sigue disponible? Me gustaría comprarlo por Escrow.`;
    const memoryContext = getBotMemoryContext(botUser, otherUsername);
    const systemPrompt = `Eres un usuario real de una comunidad retro chateando por MSN Messenger en el año 2000.
Tu apodo/usuario es: "${botUser.username}"
Tu biografía/personalidad es: "${botUser.profileData?.bio || ''}"
Tu ubicación es: "${botUser.profileData?.location || ''}"

${memoryContext}

Instrucciones de estilo:
1. Escribe un mensaje corto (1 o 2 oraciones) mostrando interés en comprar el producto "${productTitle}" de ${otherUsername}. Pregúntale de forma muy natural si sigue disponible y dile que te gustaría comprarlo ya mismo por Escrow.
2. Responde en español de forma casual, informal y directa.
3. Usa modismos de chat de MSN de los 2000 (como risas jaja, abreviaciones q, tmb, emoticonos :-P o :-D).
4. Devuelve ÚNICAMENTE tu respuesta como texto plano, sin comillas ni aclaraciones.`;
    const userPrompt = `Escribe un mensaje de chat mostrando interés en comprar el producto "${productTitle}".`;
    const fallbackText = `¡Hola! Me interesa mucho tu artículo "${productTitle}". ¿Sigue disponible? Me gustaría comprarlo por Escrow.`;
    return generateAiText(systemPrompt, userPrompt, fallbackText);
}

async function simulateBotActivity() {
    try {
        ensureDbConsistency();
        console.log("[BOT ENGINE] Iniciando ronda de simulación de actividad...");
        const registeredBots = db.users.filter(u => botsList.some(b => b.username.toLowerCase() === u.username.toLowerCase()));
        if (registeredBots.length === 0) return;
        const botUser = registeredBots[Math.floor(Math.random() * registeredBots.length)];

        // 1. ALWAYS auto-advance any orders that are in 'shipped' state where the buyer is a bot:
        const shippedOrdersWithBotBuyer = db.orders.filter(o => 
            o.status === 'shipped' && 
            botsList.some(b => b.username.toLowerCase() === o.buyer.toLowerCase())
        );
        for (const targetOrder of shippedOrdersWithBotBuyer) {
            targetOrder.status = 'completed';
            
            // Release funds to seller
            const sellerUser = db.users.find(u => u.username.toLowerCase() === targetOrder.seller.toLowerCase());
            if (sellerUser) {
                sellerUser.profileData.balance = parseFloat(sellerUser.profileData.balance) + parseFloat(targetOrder.price);
                db.transactions.push({
                    username: sellerUser.username,
                    type: 'deposit',
                    coin: targetOrder.coin,
                    amount: targetOrder.price,
                    usdValue: targetOrder.price,
                    txHash: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
                    timestamp: new Date().toISOString()
                });
            }
            
            const buyerBot = botsList.find(b => b.username.toLowerCase() === targetOrder.buyer.toLowerCase());
            
            // Generate dynamic 5-star review comment
            const reviewComment = await generateBotReviewComment(buyerBot, targetOrder.productTitle, targetOrder.seller);
            
            // Bot buyer leaves review automatically
            const botReview = {
                id: db.reviews.length + 1,
                orderId: targetOrder.id,
                rating: 5,
                comment: reviewComment,
                fromUser: targetOrder.buyer,
                toUser: targetOrder.seller,
                timestamp: new Date().toISOString()
            };
            db.reviews.push(botReview);
            targetOrder.reviewed = true;
            
            // Generate dynamic MSN thank-you message
            const thankYouMessage = await generateBotCompletionMessage(buyerBot, targetOrder.productTitle, targetOrder.seller);
            
            // Send MSN message to thank the human seller
            const newMsg = {
                id: db.chats.length + 1,
                from: targetOrder.buyer,
                to: targetOrder.seller,
                text: thankYouMessage,
                productTitle: targetOrder.productTitle,
                productId: targetOrder.productId,
                timestamp: new Date().toISOString()
            };
            db.chats.push(newMsg);
            saveDb();
            console.log(`[BOT ENGINE] El bot comprador ${targetOrder.buyer} liberó automáticamente los fondos del pedido: ${targetOrder.id} y dejó una reseña.`);
        }

        // 2. STATEFUL BUYING CYCLE FOR HUMAN PRODUCTS
        db.pendingPurchases = db.pendingPurchases || [];

        // A) Process any pending purchases that are ready
        const readyPurchases = db.pendingPurchases.filter(p => p.tickDelay <= 0);
        for (const pending of readyPurchases) {
            // Check if product is still available (exists and not sold)
            const targetProd = db.products.find(p => p.id === pending.productId && !p.sold);
            if (targetProd) {
                const buyingBot = registeredBots.find(u => u.username.toLowerCase() === pending.buyer.toLowerCase());
                if (buyingBot) {
                    const price = parseFloat(pending.price);
                    if (parseFloat(buyingBot.profileData.balance) < price) {
                        botDeposit(buyingBot.username, price + 100.00);
                    }

                    buyingBot.profileData.balance = parseFloat(buyingBot.profileData.balance) - price;
                    db.transactions.push({
                        username: buyingBot.username,
                        type: 'withdrawal',
                        coin: 'USDT',
                        amount: price,
                        usdValue: price,
                        txHash: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
                        timestamp: new Date().toISOString()
                    });

                    const newOrder = {
                        id: 'ORD-' + (100000 + db.nextOrderId++),
                        productId: targetProd.id,
                        productTitle: targetProd.title,
                        price: price,
                        buyer: buyingBot.username,
                        seller: targetProd.seller,
                        coin: 'USDT',
                        escrowMode: 'multisig',
                        moderator: 'ArbiterNode_Kraken',
                        status: 'funded',
                        shippingAddress: 'Dirección cifrada con PGP - Nodo Bot',
                        trackingNumber: null,
                        reviewed: false,
                        timestamp: new Date().toISOString()
                    };

                    db.orders.push(newOrder);
                    targetProd.sold = true;
                    saveDb();
                    console.log(`[BOT ENGINE] El bot ${buyingBot.username} concretó la compra del producto human "${targetProd.title}" de ${targetProd.seller} por $${price} USD tras período de interés`);

                    // Generate dynamic MSN purchase notification
                    const purchaseMsgText = await generateBotPurchaseMessage(buyingBot, targetProd.title, price, targetProd.seller);
                    const newMsg = {
                        id: db.chats.length + 1,
                        from: buyingBot.username,
                        to: targetProd.seller,
                        text: purchaseMsgText,
                        productTitle: targetProd.title,
                        productId: targetProd.id,
                        timestamp: new Date().toISOString()
                    };
                    db.chats.push(newMsg);
                    saveDb();
                }
            }
        }
        // Remove processed ones
        db.pendingPurchases = db.pendingPurchases.filter(p => p.tickDelay > 0);

        // Decrement tickDelay for remaining pending ones
        db.pendingPurchases.forEach(p => {
            p.tickDelay--;
        });

        // B) Check for new interest (35% chance to start negotiation on a human product)
        const humanProducts = db.products.filter(p => 
            !p.isAuction && 
            !p.sold &&
            !botsList.some(b => b.username.toLowerCase() === p.seller.toLowerCase()) &&
            !db.orders.some(o => o.productId === p.id) &&
            !db.pendingPurchases.some(pp => pp.productId === p.id)
        );

        if (humanProducts.length > 0 && Math.random() < 0.35) {
            const targetProd = humanProducts[Math.floor(Math.random() * humanProducts.length)];
            const buyingBot = registeredBots[Math.floor(Math.random() * registeredBots.length)];
            
            // Bot sends an interest message first
            const interestMsgText = await generateBotInterestMessage(buyingBot, targetProd.title, targetProd.seller);
            const newMsg = {
                id: db.chats.length + 1,
                from: buyingBot.username,
                to: targetProd.seller,
                text: interestMsgText,
                productTitle: targetProd.title,
                productId: targetProd.id,
                timestamp: new Date().toISOString()
            };
            db.chats.push(newMsg);
            
            // Add to pendingPurchases
            db.pendingPurchases.push({
                productId: targetProd.id,
                productTitle: targetProd.title,
                price: parseFloat(targetProd.price),
                buyer: buyingBot.username,
                seller: targetProd.seller,
                tickDelay: 1 // process/buy on the next simulation tick
            });
            saveDb();
            console.log(`[BOT ENGINE] El bot ${buyingBot.username} inició negociación por el producto human "${targetProd.title}" de ${targetProd.seller}. Compra programada.`);
        }

        // 3. ALWAYS check for active human auctions to bid on
        const humanAuctions = db.products.filter(p => 
            p.isAuction && 
            !p.auctionFinalized && 
            !botsList.some(b => b.username.toLowerCase() === p.seller.toLowerCase()) &&
            (p.auctionEnd && new Date(p.auctionEnd) > new Date())
        );
        if (humanAuctions.length > 0 && Math.random() < 0.40) {
            const targetAuction = humanAuctions[Math.floor(Math.random() * humanAuctions.length)];
            const biddingBot = registeredBots.find(b => b.username !== targetAuction.highestBidder);
            if (biddingBot) {
                const minBid = targetAuction.highestBidder ? targetAuction.price + 5.00 : targetAuction.price;
                
                if (parseFloat(biddingBot.profileData.balance) < minBid) {
                    botDeposit(biddingBot.username, minBid + 100.00);
                }

                if (targetAuction.highestBidder) {
                    const prevBidder = db.users.find(u => u.username.toLowerCase() === targetAuction.highestBidder.toLowerCase());
                    if (prevBidder) {
                        prevBidder.profileData.balance = parseFloat(prevBidder.profileData.balance) + parseFloat(targetAuction.price);
                        db.transactions.push({
                            username: prevBidder.username,
                            type: 'deposit',
                            coin: 'USDT',
                            amount: targetAuction.price,
                            usdValue: targetAuction.price,
                            txHash: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
                            timestamp: new Date().toISOString()
                        });
                    }
                }

                biddingBot.profileData.balance = parseFloat(biddingBot.profileData.balance) - minBid;
                db.transactions.push({
                    username: biddingBot.username,
                    type: 'withdrawal',
                    coin: 'USDT',
                    amount: minBid,
                    usdValue: minBid,
                    txHash: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
                    timestamp: new Date().toISOString()
                });

                targetAuction.price = minBid;
                targetAuction.highestBidder = biddingBot.username;
                saveDb();
                console.log(`[BOT ENGINE] El bot ${biddingBot.username} pujó automáticamente $${minBid} USD en la subasta del human: ${targetAuction.title}`);
            }
        }

        // 3.5 Proactive question from bot to human seller
        if (humanProducts.length > 0 && Math.random() < 0.30) {
            const targetProd = humanProducts[Math.floor(Math.random() * humanProducts.length)];
            const botUser = registeredBots[Math.floor(Math.random() * registeredBots.length)];
            
            const chatExists = db.chats.some(c => 
                c.from.toLowerCase() === botUser.username.toLowerCase() && 
                c.to.toLowerCase() === targetProd.seller.toLowerCase() &&
                c.productId === targetProd.id
            );
            
            if (!chatExists) {
                const proactiveText = await generateBotProactiveMessage(botUser, targetProd.title, targetProd.seller);
                
                const newMsg = {
                    id: db.chats.length + 1,
                    from: botUser.username,
                    to: targetProd.seller,
                    text: proactiveText,
                    productTitle: targetProd.title,
                    productId: targetProd.id,
                    timestamp: new Date().toISOString()
                };
                db.chats.push(newMsg);
                saveDb();
                console.log(`[BOT ENGINE] El bot ${botUser.username} le envió una pregunta al humano ${targetProd.seller} sobre "${targetProd.title}": "${proactiveText}"`);
            }
        }

        // 4. Run background simulation action
        const randomAction = Math.floor(Math.random() * 5); // 0 to 4
        
        if (randomAction === 0) {
            const isAuction = Math.random() > 0.5;
            let productData = null;
            
            try {
                // Call LLM to generate dynamic product
                productData = await generateBotProduct(botUser);
            } catch (err) {
                console.error("[BOT ENGINE] Error generating AI product, using template:", err.message);
            }
            
            // Fallback to static pool if LLM failed or parsed invalid
            if (!productData) {
                const randomProd = botProductPool[Math.floor(Math.random() * botProductPool.length)];
                productData = {
                    title: randomProd.title,
                    desc: randomProd.desc,
                    price: randomProd.price,
                    category: isAuction ? 'Subastas' : 'Electronics',
                    condition: randomProd.condition,
                    icon: randomProd.icon
                };
            }

            const alreadyListed = db.products.some(p => p.title === productData.title && p.seller === botUser.username);
            if (alreadyListed) return;

            let auctionEnd = null;
            if (isAuction) {
                auctionEnd = new Date(Date.now() + 5 * 60 * 1000).toISOString();
            }

            // Map image dynamically based on keywords
            const imageUrl = getRetroImageUrl(productData.title, productData.category);

            const newProduct = {
                id: db.nextProductId++,
                title: productData.title,
                description: productData.desc,
                price: productData.price,
                seller: botUser.username,
                category: isAuction ? 'Subastas' : (productData.category || 'Electronics'),
                condition: productData.condition || 'Usado - Buen Estado',
                icon: productData.icon || '📦',
                location: botUser.profileData.location,
                image: imageUrl,
                isAuction: isAuction,
                auctionEnd: auctionEnd,
                auctionFinalized: false,
                highestBidder: null,
                timestamp: new Date().toISOString()
            };

            db.products.push(newProduct);
            saveDb();
            console.log(`[BOT ENGINE] El bot ${botUser.username} publicó un producto dinámico: ${newProduct.title} en categoría "${newProduct.category}" (${isAuction ? 'Subasta' : 'Venta directa'})`);
            
        } else if (randomAction === 1) {
            const activeAuctions = db.products.filter(p => p.isAuction && !p.auctionFinalized && p.seller !== botUser.username && p.highestBidder !== botUser.username && (p.auctionEnd && new Date(p.auctionEnd) > new Date()));
            if (activeAuctions.length === 0) return;

            const targetAuction = activeAuctions[Math.floor(Math.random() * activeAuctions.length)];
            const minBid = targetAuction.highestBidder ? targetAuction.price + 1.00 : targetAuction.price;
            
            if (parseFloat(botUser.profileData.balance) < minBid) {
                const depositAmount = minBid + 100.00;
                botDeposit(botUser.username, depositAmount);
            }

            if (targetAuction.highestBidder) {
                const prevBidder = db.users.find(u => u.username.toLowerCase() === targetAuction.highestBidder.toLowerCase());
                if (prevBidder) {
                    prevBidder.profileData.balance = parseFloat(prevBidder.profileData.balance) + parseFloat(targetAuction.price);
                    db.transactions.push({
                        username: prevBidder.username,
                        type: 'deposit',
                        coin: 'USDT',
                        amount: targetAuction.price,
                        usdValue: targetAuction.price,
                        txHash: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
                        timestamp: new Date().toISOString()
                    });
                }
            }

            botUser.profileData.balance = parseFloat(botUser.profileData.balance) - minBid;
            db.transactions.push({
                username: botUser.username,
                type: 'withdrawal',
                coin: 'USDT',
                amount: minBid,
                usdValue: minBid,
                txHash: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
                timestamp: new Date().toISOString()
            });

            targetAuction.price = minBid;
            targetAuction.highestBidder = botUser.username;
            saveDb();
            console.log(`[BOT ENGINE] El bot ${botUser.username} pujó $${minBid} USD en la subasta: ${targetAuction.title}`);

        } else if (randomAction === 2) {
            const writeNewThread = Math.random() > 0.5;
            db.threads = db.threads || [];
            
            if (writeNewThread || db.threads.length === 0) {
                let threadData = null;
                try {
                    threadData = await generateBotForumThread(botUser);
                } catch (err) {
                    console.error("[BOT ENGINE] Error generating AI forum thread:", err.message);
                }
                
                if (!threadData) {
                    const template = botForumThreads[Math.floor(Math.random() * botForumThreads.length)];
                    threadData = {
                        category: template.category,
                        title: template.title,
                        content: template.content
                    };
                }
                
                const alreadyExists = db.threads.some(t => t.title === threadData.title);
                if (alreadyExists) return;

                const newThread = {
                    id: db.nextThreadId++,
                    category: threadData.category || 'security',
                    title: threadData.title,
                    author: botUser.username,
                    content: threadData.content,
                    replies: [],
                    timestamp: new Date().toISOString()
                };
                db.threads.push(newThread);
                saveDb();
                console.log(`[BOT ENGINE] El bot ${botUser.username} creó un nuevo hilo dinámico en el foro: "${newThread.title}"`);
            } else {
                const targetThread = db.threads[Math.floor(Math.random() * db.threads.length)];
                let replyContent = null;
                
                try {
                    replyContent = await generateBotForumReply(botUser, targetThread);
                } catch (err) {
                    console.error("[BOT ENGINE] Error generating AI forum reply:", err.message);
                }
                
                if (!replyContent) {
                    const replyPool = botForumReplies.find(r => r.category === targetThread.category);
                    if (replyPool) {
                        replyContent = replyPool.replies[Math.floor(Math.random() * replyPool.replies.length)];
                    } else {
                        replyContent = "Interesante tema, gracias por compartir.";
                    }
                }
                
                const newReply = {
                    author: botUser.username,
                    content: replyContent,
                    timestamp: new Date().toISOString()
                };
                targetThread.replies = targetThread.replies || [];
                targetThread.replies.push(newReply);
                saveDb();
                console.log(`[BOT ENGINE] El bot ${botUser.username} respondió dinámicamente en el hilo: "${targetThread.title}"`);
            }

        } else if (randomAction === 3) {
            const activeOrders = db.orders.filter(o => 
                o.status !== 'completed' && 
                (botsList.some(b => b.username.toLowerCase() === o.buyer.toLowerCase()) || 
                 botsList.some(b => b.username.toLowerCase() === o.seller.toLowerCase()))
            );
            if (activeOrders.length === 0) return;

            const targetOrder = activeOrders[Math.floor(Math.random() * activeOrders.length)];
            const isBotSeller = botsList.some(b => b.username.toLowerCase() === targetOrder.seller.toLowerCase());
            
            if (targetOrder.status === 'funded' && isBotSeller) {
                targetOrder.status = 'shipped';
                targetOrder.trackingNumber = 'USPS-BOT-' + Math.floor(100000000 + Math.random() * 900000000);
                saveDb();
                console.log(`[BOT ENGINE] El bot vendedor ${targetOrder.seller} registró el envío para el pedido: ${targetOrder.id}`);
            } else if (targetOrder.status === 'shipped' && !isBotSeller) {
                targetOrder.status = 'completed';
                
                const sellerUser = db.users.find(u => u.username.toLowerCase() === targetOrder.seller.toLowerCase());
                if (sellerUser) {
                    sellerUser.profileData.balance = parseFloat(sellerUser.profileData.balance) + parseFloat(targetOrder.price);
                    db.transactions.push({
                        username: sellerUser.username,
                        type: 'deposit',
                        coin: targetOrder.coin,
                        amount: targetOrder.price,
                        usdValue: targetOrder.price,
                        txHash: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
                        timestamp: new Date().toISOString()
                    });
                }
                
                const buyerBot = botsList.find(b => b.username.toLowerCase() === targetOrder.buyer.toLowerCase());
                
                // Generate dynamic AI comment and MSN message
                const reviewComment = await generateBotReviewComment(buyerBot, targetOrder.productTitle, targetOrder.seller);
                const thankYouMessage = await generateBotCompletionMessage(buyerBot, targetOrder.productTitle, targetOrder.seller);

                // Bot buyer leaves review automatically
                const botReview = {
                    id: db.reviews.length + 1,
                    orderId: targetOrder.id,
                    rating: 5,
                    comment: reviewComment,
                    fromUser: targetOrder.buyer,
                    toUser: targetOrder.seller,
                    timestamp: new Date().toISOString()
                };
                db.reviews.push(botReview);
                targetOrder.reviewed = true;
                
                saveDb();
                console.log(`[BOT ENGINE] El bot comprador ${targetOrder.buyer} liberó los fondos del pedido: ${targetOrder.id} y dejó una reseña.`);

                // Send MSN message to thank the human seller
                const newMsg = {
                    id: db.chats.length + 1,
                    from: targetOrder.buyer,
                    to: targetOrder.seller,
                    text: thankYouMessage,
                    productTitle: targetOrder.productTitle,
                    productId: targetOrder.productId,
                    timestamp: new Date().toISOString()
                };
                db.chats.push(newMsg);
                saveDb();
            }
        } else if (randomAction === 4) {
            // Find products listed by bot users that are direct sales
            const botProducts = db.products.filter(p => 
                !p.isAuction && 
                !p.sold &&
                botsList.some(b => b.username.toLowerCase() === p.seller.toLowerCase()) &&
                !db.orders.some(o => o.productId === p.id)
            );
            if (botProducts.length === 0) return;

            const targetProd = botProducts[Math.floor(Math.random() * botProducts.length)];
            const price = parseFloat(targetProd.price);

            // Ensure bot has balance, deposit if not
            if (parseFloat(botUser.profileData.balance) < price) {
                const depositAmount = price + 100.00;
                botDeposit(botUser.username, depositAmount);
            }

            // Deduct balance
            botUser.profileData.balance = parseFloat(botUser.profileData.balance) - price;
            
            // Log crypto withdrawal
            db.transactions.push({
                username: botUser.username,
                type: 'withdrawal',
                coin: 'USDT',
                amount: price,
                usdValue: price,
                txHash: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
                timestamp: new Date().toISOString()
            });

            // Create Escrow Order
            const newOrder = {
                id: 'ORD-' + (100000 + db.nextOrderId++),
                productId: targetProd.id,
                productTitle: targetProd.title,
                price: price,
                buyer: botUser.username,
                seller: targetProd.seller,
                coin: 'USDT',
                escrowMode: 'multisig',
                moderator: 'ArbiterNode_Kraken',
                status: 'funded',
                shippingAddress: 'Dirección cifrada con PGP - Nodo Bot',
                trackingNumber: null,
                reviewed: false,
                timestamp: new Date().toISOString()
            };

            db.orders.push(newOrder);
            targetProd.sold = true;
            saveDb();
            console.log(`[BOT ENGINE] El bot ${botUser.username} compró el producto bot "${targetProd.title}" de ${targetProd.seller} por $${price} USD (Escrow iniciado)`);
        }
    } catch (err) {
        console.error("Error en simulación de bot:", err);
    }
}

// =========================================================================
// BOT SIMULATION ENDPOINT (Vercel Cron Trigger)
// =========================================================================

// GET and POST endpoint to run the bot simulation round
app.all('/api/bots/simulate', async (req, res) => {
    try {
        console.log("[BOT ENGINE] Invocando ronda de simulación de bots via API...");
        await simulateBotActivity();
        res.json({ success: true, message: "Simulación de bots ejecutada con éxito." });
    } catch (err) {
        console.error("[BOT ENGINE] Error al ejecutar simulación via API:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Start Bot Engine & Server local hooks
if (!process.env.VERCEL) {
    // Local mode: connect to Mongo and run local intervals
    connectToMongo().then(() => {
        setTimeout(simulateBotActivity, 5000);
        setInterval(simulateBotActivity, 25000);
    });

    // Serve static assets from compilation folder locally
    app.use(express.static(path.join(__dirname, '../client/dist')));

    // SPA Wildcard fallback locally
    app.use((req, res) => {
        res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
    });

    app.listen(PORT, () => {
        console.log(`Servidor corriendo en el puerto ${PORT}`);
    });
}

module.exports = app;