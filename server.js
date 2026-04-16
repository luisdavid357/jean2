require('dotenv').config();

const express = require('express');
const cors = require('cors');

// SDK NUEVO TRANSBANK
const {
  WebpayPlus,
  Options,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  Environment
} = require('transbank-sdk');

const app = express();

// ===============================
// MIDDLEWARES
// ===============================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir frontend
app.use(express.static('public'));

// ===============================
// CONFIGURACIÓN WEBPAY (PRUEBAS)
// ===============================
const tx = new WebpayPlus.Transaction(
  new Options(
    IntegrationCommerceCodes.WEBPAY_PLUS,
    IntegrationApiKeys.WEBPAY,
    Environment.Integration
  )
);

// ===============================
// CREAR PAGO
// ===============================
app.post('/crear-pago', async (req, res) => {

  const cart = req.body.cart || [];

  let total = 0;

  cart.forEach(item => {
    total += item.price * (item.quantity || 1);
  });

  if (total <= 0) {
    return res.status(400).json({ error: 'Total inválido' });
  }

  try {

    const buyOrder = 'orden_' + Date.now();
    const sessionId = 'sesion_' + Date.now();
    const returnUrl = 'http://localhost:5500/retorno';

    console.log("🛒 Carrito:", cart);
    console.log("💰 Total:", total);

    const response = await tx.create(
      buyOrder,
      sessionId,
      total,
      returnUrl
    );

    res.json({
      url: response.url,
      token: response.token
    });

  } catch (error) {
    console.error('❌ Error creando pago:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===============================
// RETORNO DE WEBPAY (FIX ERROR token_ws)
// ===============================
app.all('/retorno', async (req, res) => {

  // 🔥 FIX AQUÍ
  const token = req.body?.token_ws || req.query?.token_ws;

  console.log("🔁 Token recibido:", token);

  if (!token) {
    return res.send('<h2>❌ No se recibió token</h2>');
  }

  try {

    const response = await tx.commit(token);

    console.log("✅ Respuesta Webpay:", response);

    if (response.status === 'AUTHORIZED') {
      res.send(`
        <h1>✅ Pago aprobado</h1>
        <p><strong>Orden:</strong> ${response.buy_order}</p>
        <p><strong>Monto:</strong> $${response.amount}</p>
        <a href="/">Volver al inicio</a>
      `);
    } else {
      res.send(`
        <h1>❌ Pago rechazado</h1>
        <a href="/">Intentar nuevamente</a>
      `);
    }

  } catch (error) {
    console.error('❌ Error confirmando pago:', error);
    res.send('<h1>Error al confirmar el pago</h1>');
  }
});

// ===============================
// SERVIDOR
// ===============================
const PORT = 5500;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});