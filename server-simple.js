const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Inicializar Stripe después de cargar las variables de entorno
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Para webhooks de MercadoPago
app.use(express.static('.'));

// Base de datos SQLite (se crea automáticamente)
const dbPath = process.env.DB_FILE || './suscripciones.db';
const db = new sqlite3.Database(dbPath);

// Configuración de email
let emailConfigured = false;
let transporter = null;

function setupEmail() {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    // ✅ CORREGIDO: era createTransporter, debe ser createTransport
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    emailConfigured = true;
    console.log('✅ Email configurado correctamente');
  } else {
    console.log('⚠️  Email no configurado - Los correos no se enviarán');
  }
}

// Inicializar base de datos SQLite
function initDatabase() {
  return new Promise((resolve, reject) => {
    // Tabla de clientes
    db.run(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre VARCHAR(100) NOT NULL,
        apellido VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) return reject(err);
      
      // Tabla de pedidos
      db.run(`
        CREATE TABLE IF NOT EXISTS pedidos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER,
          orden_numero VARCHAR(100) UNIQUE NOT NULL,
          datos_suscripcion TEXT,
          datos_extras TEXT,
          total_recurrente DECIMAL(10,2) DEFAULT 0,
          total_unico DECIMAL(10,2) DEFAULT 0,
          estado VARCHAR(50) DEFAULT 'pending',
          subscription_paid INTEGER DEFAULT 0,
          extras_paid INTEGER DEFAULT 0,
          payment_id_subscription VARCHAR(255),
          payment_id_extras VARCHAR(255),
          fecha_pedido DATETIME DEFAULT CURRENT_TIMESTAMP,
          datos_originales TEXT,
          FOREIGN KEY (customer_id) REFERENCES customers (id)
        )
      `, (err) => {
        if (err) return reject(err);
        
        // Agregar columnas si no existen (para bases de datos existentes)
        db.run(`ALTER TABLE pedidos ADD COLUMN subscription_paid INTEGER DEFAULT 0`, () => {});
        db.run(`ALTER TABLE pedidos ADD COLUMN extras_paid INTEGER DEFAULT 0`, () => {});
        db.run(`ALTER TABLE pedidos ADD COLUMN payment_id_subscription VARCHAR(255)`, () => {});
        db.run(`ALTER TABLE pedidos ADD COLUMN payment_id_extras VARCHAR(255)`, () => {});
        
        console.log('✅ Base de datos SQLite inicializada');
        resolve();
      });
    });
  });
}

// Endpoint para crear pedido y generar checkout de Stripe
app.post('/api/orders', async (req, res) => {
  const orderData = req.body;
  const ordenNumero = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
  
  // Calcular totales
  const totalRecurrente = orderData.subscription ? orderData.subscription.price : 0;
  const totalUnico = orderData.extras.reduce((sum, item) => sum + item.price, 0);
  
  try {
    // Insertar o actualizar cliente
    const customerId = await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO customers (nombre, apellido, email) VALUES (?, ?, ?)',
        [orderData.customer.nombre, orderData.customer.apellido, orderData.customer.email],
        function(err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });
    
    // Crear pedido
    const orderId = await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO pedidos 
        (customer_id, orden_numero, datos_suscripcion, datos_extras, total_recurrente, total_unico, datos_originales, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        customerId,
        ordenNumero,
        orderData.subscription ? JSON.stringify(orderData.subscription) : null,
        JSON.stringify(orderData.extras),
        totalRecurrente,
        totalUnico,
        JSON.stringify(orderData),
        'pending'
      ], function(err) {
        if (err) return reject(err);
        resolve(this.lastID);
      });
    });

    // Mapear productos a Price IDs de Stripe
    const priceMapping = {
      'Paquete 1': process.env.STRIPE_PRICE_PAQUETE_1,
      'Paquete 2': process.env.STRIPE_PRICE_PAQUETE_2,
      'Pagina web': process.env.STRIPE_PRICE_PAGINA_WEB,
      'Logos': process.env.STRIPE_PRICE_LOGOS
    };

    // Crear line_items para Stripe
    const lineItems = [];
    
    // Agregar suscripción si existe
    if (orderData.subscription) {
      const priceId = priceMapping[orderData.subscription.name];
      if (priceId) {
        lineItems.push({
          price: priceId,
          quantity: 1
        });
      }
    }
    
    // Agregar productos extras
    orderData.extras.forEach(extra => {
      const priceId = priceMapping[extra.name];
      if (priceId) {
        lineItems.push({
          price: priceId,
          quantity: 1
        });
      }
    });

    console.log('🔍 Creando Stripe Checkout con line_items:', lineItems);

    // Determinar el modo del checkout
    const hasSubscription = orderData.subscription;
    const mode = hasSubscription ? 'subscription' : 'payment';

    // Crear Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: mode,
      success_url: `${process.env.APP_URL}/order-status.html?session_id={CHECKOUT_SESSION_ID}&order=${ordenNumero}`,
      cancel_url: `${process.env.APP_URL}/compra.html?canceled=true`,
      customer_email: orderData.customer.email,
      metadata: {
        order_number: ordenNumero,
        customer_id: customerId.toString()
      }
    });

    console.log('✅ Stripe Checkout creado:', session.id);
    console.log('🔗 URL del checkout:', session.url);
    
    res.json({
      success: true,
      orderId: orderId,
      orderNumber: ordenNumero,
      customerId: customerId,
      checkoutUrl: session.url,
      sessionId: session.id,
      totalRecurrente: totalRecurrente,
      totalUnico: totalUnico
    });
    
  } catch (error) {
    console.error('❌ Error creando pedido con Stripe:', error);
    res.status(500).json({ error: 'Error creando pedido: ' + error.message });
  }
});

// Función para enviar correo
async function sendConfirmationEmail(orderData, orderNumber) {
  if (!emailConfigured) {
    console.log('⚠️  Email no configurado - Saltando envío');
    return false;
  }

  try {
    const { customer, subscription, extras } = orderData;
    
    const subscriptionInfo = subscription ? 
      `🔄 <strong>Suscripción Mensual:</strong><br>${subscription.name} - $${subscription.price} MXN/mes` : '';
    
    const extrasInfo = extras.length > 0 ?
      extras.map(item => `💎 <strong>Producto:</strong> ${item.name} - $${item.price} MXN (pago único)`).join('<br>') : '';

    const totalRecurrente = subscription ? subscription.price : 0;
    const totalUnico = extras.reduce((sum, item) => sum + item.price, 0);

    const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #27ae60; color: white; padding: 20px; text-align: center; border-radius: 8px; }
    .content { padding: 20px; background: #f9f9f9; margin: 10px 0; border-radius: 8px; }
    .order-details { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #27ae60; }
    .total { font-weight: bold; font-size: 18px; color: #27ae60; margin-top: 15px; }
    .footer { text-align: center; padding: 20px; color: #666; }
    .important { background: #fff3cd; padding: 10px; border-radius: 5px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 ¡Confirmación de tu Pedido!</h1>
    </div>
    
    <div class="content">
      <h2>Hola ${customer.nombre},</h2>
      <p>¡Gracias por tu compra! Hemos registrado tu pedido correctamente.</p>
      
      <div class="order-details">
        <h3>📋 Detalles del Pedido</h3>
        <p><strong>Número de pedido:</strong> ${orderNumber}</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-MX')}</p>
        <p><strong>Cliente:</strong> ${customer.nombre} ${customer.apellido}</p>
        <p><strong>Email:</strong> ${customer.email}</p>
      </div>
      
      <div class="order-details">
        <h3>🛒 Productos Seleccionados</h3>
        ${subscriptionInfo ? `<p>${subscriptionInfo}</p>` : ''}
        ${extrasInfo ? `<p>${extrasInfo}</p>` : ''}
        
        <div class="total">
          💳 <strong>Total mensual:</strong> $${totalRecurrente} MXN/mes<br>
          💰 <strong>Total único:</strong> $${totalUnico} MXN
        </div>
      </div>
      
      <div class="important">
        <h3>✅ Pago Completado</h3>
        <p>Tu pago ha sido procesado exitosamente a través de <strong>Stripe</strong>.</p>
        <ul>
          ${subscription ? '<li><strong>Suscripción mensual</strong> - Activada y funcionando</li>' : ''}
          ${extras.length > 0 ? '<li><strong>Productos adicionales</strong> - Acceso inmediato disponible</li>' : ''}
        </ul>
        <p>¡Ya tienes acceso completo a todos tus productos y servicios!</p>
      </div>
      
      <div class="order-details">
        <h3>📞 ¿Necesitas ayuda?</h3>
        <p>Si tienes alguna pregunta sobre tu pedido, no dudes en contactarnos.</p>
        <p>📧 Email: soporte@tuempresa.com</p>
        <p>📱 WhatsApp: +52 XXX XXX XXXX</p>
      </div>
    </div>
    
    <div class="footer">
      <p>¡Gracias por elegirnos! 🚀</p>
      <p><strong>Equipo de Soporte</strong></p>
    </div>
  </div>
</body>
</html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: customer.email,
      subject: `🎉 Confirmación de Pedido ${orderNumber} - Tu Suscripción Premium`,
      html: emailContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Correo enviado exitosamente:', info.messageId);
    return true;
    
  } catch (error) {
    console.error('❌ Error enviando correo:', error);
    return false;
  }
}

// Endpoint para obtener pedidos
app.get('/api/orders/:email', (req, res) => {
  const { email } = req.params;
  
  db.all(`
    SELECT p.*, c.nombre, c.apellido, c.email
    FROM pedidos p
    JOIN customers c ON p.customer_id = c.id
    WHERE c.email = ?
    ORDER BY p.fecha_pedido DESC
  `, [email], (err, rows) => {
    if (err) {
      console.error('❌ Error obteniendo pedidos:', err);
      return res.status(500).json({ error: 'Error obteniendo pedidos' });
    }
    res.json(rows);
  });
});

// Endpoint de salud
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: 'SQLite',
    email: emailConfigured ? 'Configurado' : 'No configurado'
  });
});

// Endpoint para ver todos los pedidos (admin)
app.get('/api/admin/orders', (req, res) => {
  db.all(`
    SELECT p.*, c.nombre, c.apellido, c.email
    FROM pedidos p
    JOIN customers c ON p.customer_id = c.id
    ORDER BY p.fecha_pedido DESC
  `, [], (err, rows) => {
    if (err) {
      console.error('❌ Error obteniendo todos los pedidos:', err);
      return res.status(500).json({ error: 'Error obteniendo pedidos' });
    }
    res.json(rows);
  });
});

// Endpoint de prueba para webhooks
app.get('/api/webhooks/test', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Webhook endpoint accessible',
    timestamp: new Date().toISOString(),
    ngrok_url: process.env.APP_URL
  });
});

// Función para manejar checkout completado de Stripe
async function handleCheckoutCompleted(session) {
  try {
    console.log('🔍 Procesando checkout completado:', session.id);
    console.log('📋 Metadata:', session.metadata);
    
    const orderNumber = session.metadata.order_number;
    
    if (!orderNumber) {
      console.error('❌ No se encontró order_number en metadata');
      return;
    }
    
    // Buscar el pedido en la base de datos
    const order = await new Promise((resolve, reject) => {
      db.get(`
        SELECT p.*, c.nombre, c.apellido, c.email
        FROM pedidos p
        JOIN customers c ON p.customer_id = c.id
        WHERE p.orden_numero = ?
      `, [orderNumber], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
    
    if (!order) {
      console.error(`❌ Pedido no encontrado: ${orderNumber}`);
      return;
    }
    
    console.log(`✅ Pedido encontrado: ${orderNumber}`);
    
    // Obtener detalles del checkout desde Stripe
    const checkoutSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items', 'subscription']
    });
    
    console.log('🔍 Detalles del checkout:', {
      mode: checkoutSession.mode,
      payment_status: checkoutSession.payment_status,
      subscription_id: checkoutSession.subscription?.id
    });
    
    // Determinar qué se pagó basado en el modo y line_items
    const orderData = JSON.parse(order.datos_originales);
    const hasSubscription = orderData.subscription;
    const hasExtras = orderData.extras && orderData.extras.length > 0;
    
    if (checkoutSession.mode === 'subscription') {
      // Es una suscripción, marcar como pagada
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE pedidos SET subscription_paid = 1, payment_id_subscription = ? WHERE orden_numero = ?',
          [checkoutSession.subscription?.id || session.id, orderNumber],
          function(err) {
            if (err) return reject(err);
            resolve();
          }
        );
      });
      console.log(`✅ Suscripción marcada como pagada para ${orderNumber}`);
    } else if (checkoutSession.mode === 'payment') {
      // Es un pago único, marcar extras como pagados
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE pedidos SET extras_paid = 1, payment_id_extras = ? WHERE orden_numero = ?',
          [session.payment_intent || session.id, orderNumber],
          function(err) {
            if (err) return reject(err);
            resolve();
          }
        );
      });
      console.log(`✅ Extras marcados como pagados para ${orderNumber}`);
    }
    
    // Verificar si todos los pagos están completos
    const updatedOrder = await new Promise((resolve, reject) => {
      db.get(`
        SELECT * FROM pedidos WHERE orden_numero = ?
      `, [orderNumber], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
    
    const subscriptionComplete = !hasSubscription || updatedOrder.subscription_paid === 1;
    const extrasComplete = !hasExtras || updatedOrder.extras_paid === 1;
    const allPaymentsComplete = subscriptionComplete && extrasComplete;
    
    console.log(`📊 Estado de pagos para ${orderNumber}:`, {
      hasSubscription,
      hasExtras,
      subscriptionPaid: updatedOrder.subscription_paid === 1,
      extrasPaid: updatedOrder.extras_paid === 1,
      allComplete: allPaymentsComplete
    });
    
    // Si todos los pagos están completos, marcar como confirmado y enviar correo
    if (allPaymentsComplete) {
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE pedidos SET estado = ? WHERE orden_numero = ?',
          ['confirmed', orderNumber],
          function(err) {
            if (err) return reject(err);
            resolve();
          }
        );
      });
      
      // Enviar correo de confirmación
      await sendConfirmationEmail(orderData, orderNumber);
      
      console.log(`🎉 TODOS los pagos completos para ${orderNumber} - Correo enviado automáticamente`);
    } else {
      console.log(`⏳ Pago parcial para ${orderNumber} - Esperando otros pagos`);
    }
    
  } catch (error) {
    console.error('❌ Error manejando checkout completado:', error);
  }
}

// Webhook de Stripe para eventos de pago
app.post('/api/webhooks/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  
  try {
    if (endpointSecret) {
      // Verificar firma del webhook en producción
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      // Para desarrollo, solo parseamos el JSON sin verificar firma
      event = JSON.parse(req.body);
    }
    
    console.log('🔔 Webhook recibido de Stripe:', event.type);
    
    // Manejar diferentes tipos de eventos
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('✅ Checkout completado:', session.id);
        await handleCheckoutCompleted(session);
        break;
        
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('💳 Pago único exitoso:', paymentIntent.id);
        // Para pagos únicos sin checkout, podríamos manejar aquí si es necesario
        break;
        
      case 'invoice.payment_succeeded':
        const invoice = event.data.object;
        console.log('🔄 Pago de suscripción exitoso:', invoice.id);
        // Para pagos recurrentes de suscripción
        break;
        
      case 'customer.subscription.created':
        const subscription = event.data.object;
        console.log('📅 Suscripción creada:', subscription.id);
        break;
        
      case 'customer.subscription.updated':
        const updatedSubscription = event.data.object;
        console.log('🔄 Suscripción actualizada:', updatedSubscription.id);
        break;
        
      default:
        console.log(`❓ Evento no manejado: ${event.type}`);
    }
    
    res.json({received: true});
    
  } catch (err) {
    console.error('❌ Error procesando webhook de Stripe:', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});
// Función auxiliar para procesar confirmación de pago (mantenida para compatibilidad)
async function processPaymentConfirmation({ orderNumber, paymentType, paymentId, status }) {
  try {
    console.log(`� Procesando confirmación de pago: ${orderNumber} (${paymentType})`);
    
    // Buscar el pedido
    const order = await new Promise((resolve, reject) => {
      db.get(`
        SELECT p.*, c.nombre, c.apellido, c.email
        FROM pedidos p
        JOIN customers c ON p.customer_id = c.id
        WHERE p.orden_numero = ?
      `, [orderNumber], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
    
    if (!order) {
      console.log(`⚠️ Pedido no encontrado: ${orderNumber}`);
      return;
    }

    // Verificar que el pago fue aprobado
    if (status !== 'approved' && status !== 'succeeded') {
      console.log(`⚠️ Pago no aprobado para pedido ${orderNumber}: ${status}`);
      return;
    }

    // Actualizar el estado específico del tipo de pago
    const updateField = paymentType === 'subscription' ? 'subscription_paid = 1' : 'extras_paid = 1';
    const paymentIdField = paymentType === 'subscription' ? 'payment_id_subscription' : 'payment_id_extras';
    
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE pedidos SET ${updateField}, ${paymentIdField} = ? WHERE orden_numero = ?`,
        [paymentId, orderNumber],
        function(err) {
          if (err) return reject(err);
          resolve();
        }
      );
    });

    // Verificar si AMBOS pagos están completos
    const updatedOrder = await new Promise((resolve, reject) => {
      db.get(`
        SELECT p.*, c.nombre, c.apellido, c.email
        FROM pedidos p
        JOIN customers c ON p.customer_id = c.id
        WHERE p.orden_numero = ?
      `, [orderNumber], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });

    const orderData = JSON.parse(updatedOrder.datos_originales);
    const hasSubscription = orderData.subscription;
    const hasExtras = orderData.extras && orderData.extras.length > 0;
    
    // Determinar si todos los pagos necesarios están completos
    const subscriptionComplete = !hasSubscription || updatedOrder.subscription_paid === 1;
    const extrasComplete = !hasExtras || updatedOrder.extras_paid === 1;
    const allPaymentsComplete = subscriptionComplete && extrasComplete;

    console.log(`📊 Estado de pagos para ${orderNumber}:`, {
      hasSubscription,
      hasExtras,
      subscriptionPaid: updatedOrder.subscription_paid === 1,
      extrasPaid: updatedOrder.extras_paid === 1,
      allComplete: allPaymentsComplete
    });

    // Solo enviar correo si TODOS los pagos están completos
    if (allPaymentsComplete) {
      // Actualizar estado general a confirmed
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE pedidos SET estado = ? WHERE orden_numero = ?',
          ['confirmed', orderNumber],
          function(err) {
            if (err) return reject(err);
            resolve();
          }
        );
      });

      // Enviar correo de confirmación
      await sendConfirmationEmail(orderData, orderNumber);
      
      console.log(`🎉 TODOS los pagos completos para ${orderNumber} - Correo enviado automáticamente`);
    } else {
      console.log(`⏳ Pago parcial para ${orderNumber} (${paymentType}) - Esperando otros pagos`);
    }
    
  } catch (error) {
    console.error('❌ Error procesando confirmación automática:', error);
  }
}

// Endpoint para confirmar pago (llamado manualmente desde order-status.html)
app.post('/api/payment-confirmed', async (req, res) => {
  const { orderNumber, paymentType, paymentId, status } = req.body;
  
  try {
    await processPaymentConfirmation({ orderNumber, paymentType, paymentId, status });
    
    res.json({ 
      success: true, 
      message: 'Pago procesado correctamente',
      orderNumber: orderNumber
    });
    
  } catch (error) {
    console.error('❌ Error confirmando pago manualmente:', error);
    res.status(500).json({ error: 'Error confirmando pago: ' + error.message });
  }
});

// Endpoint para obtener estado de pedido
app.get('/api/orders/status/:orderNumber', async (req, res) => {
  const { orderNumber } = req.params;
  
  try {
    const order = await new Promise((resolve, reject) => {
      db.get(`
        SELECT p.*, c.nombre, c.apellido, c.email
        FROM pedidos p
        JOIN customers c ON p.customer_id = c.id
        WHERE p.orden_numero = ?
      `, [orderNumber], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    
    // Parsear datos originales para obtener la estructura completa
    const orderData = JSON.parse(order.datos_originales);
    const subscription = orderData.subscription;
    const extras = orderData.extras || [];
    
    // Usar las nuevas columnas para determinar estado real de pagos
    const subscriptionPaid = order.subscription_paid === 1;
    const extrasPaid = order.extras_paid === 1;
    
    console.log(`📊 Consultando estado de ${orderNumber}:`, {
      subscriptionPaid,
      extrasPaid,
      subscription_paid_column: order.subscription_paid,
      extras_paid_column: order.extras_paid,
      estado: order.estado
    });
    
    res.json({
      orderNumber: order.orden_numero,
      customer: {
        nombre: order.nombre,
        apellido: order.apellido,
        email: order.email
      },
      subscription: subscription,
      extras: extras,
      subscriptionPaid: subscriptionPaid,
      extrasPaid: extrasPaid,
      fecha_pedido: order.fecha_pedido,
      estado: order.estado
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo estado del pedido:', error);
    res.status(500).json({ error: 'Error obteniendo estado del pedido: ' + error.message });
  }
});

// Inicializar servidor
async function startServer() {
  try {
    await initDatabase();
    setupEmail();
    
    app.listen(PORT, () => {
      console.log(`\n🚀 ¡Servidor iniciado exitosamente!`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`📱 Carrito: http://localhost:${PORT}/compra.html`);
      console.log(`🗄️  Base de datos: SQLite (${dbPath})`);
      console.log(`📧 Email: ${emailConfigured ? '✅ Configurado' : '⚠️  No configurado'}`);
      console.log(`💳 Stripe: ✅ Configurado y funcionando`);
      console.log(`\n🎯 ¡Todo listo para recibir pedidos con Stripe!`);
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

// Manejar cierre limpio
process.on('SIGINT', () => {
  console.log('\n🔄 Cerrando servidor...');
  db.close((err) => {
    if (err) console.error(err.message);
    console.log('✅ Base de datos cerrada correctamente');
    process.exit(0);
  });
});

startServer();

module.exports = app;