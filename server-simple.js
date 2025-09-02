const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Inicializar Stripe solo si está configurado
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} else {
  console.log('⚠️  Stripe no configurado - Las funciones de pago no estarán disponibles');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
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

// Endpoint para crear pedido y generar URLs de pago
app.post('/api/orders', async (req, res) => {
  const orderData = req.body;
  const ordenNumero = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
  
  // Calcular totales
  const totalRecurrente = orderData.subscription ? orderData.subscription.price : 0;
  const totalUnico = orderData.extras.reduce((sum, item) => sum + item.price, 0);
  
  try {
    // Validar que Stripe esté configurado
    if (!stripe) {
      return res.status(500).json({ 
        error: 'Error: Stripe no está configurado. Por favor configura STRIPE_SECRET_KEY en el archivo .env' 
      });
    }

    // Validar que siempre haya suscripción
    if (!orderData.subscription) {
      return res.status(400).json({ 
        error: 'Error: Debe seleccionar una suscripción. No se pueden comprar solo productos extras.' 
      });
    }

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

    // Validar que siempre haya suscripción
    if (!orderData.subscription) {
      return res.status(400).json({ 
        error: 'Error: Debe seleccionar una suscripción. No se pueden comprar solo productos extras.' 
      });
    }

    // Crear sesión de Stripe Checkout
    const lineItems = [];
    
    // Agregar suscripción (SIEMPRE requerida)
    let priceId;
    switch (orderData.subscription.name) {
      case 'Paquete Premium':
        priceId = process.env.STRIPE_PRICE_PREMIUM;
        break;
      case 'Paquete Básico':
        priceId = process.env.STRIPE_PRICE_BASIC;
        break;
      default:
        priceId = process.env.STRIPE_PRICE_BASIC;
    }
    
    lineItems.push({
      price: priceId,
      quantity: 1,
    });
    
    // Agregar productos extras (OPCIONAL)
    if (orderData.extras && orderData.extras.length > 0) {
      for (const extra of orderData.extras) {
        let extraPriceId;
        switch (extra.name) {
          case 'Página web':
            extraPriceId = process.env.STRIPE_PRICE_WEBSITE;
            break;
          case 'Logos':
            extraPriceId = process.env.STRIPE_PRICE_LOGOS;
            break;
          default:
            // Para productos dinámicos, crear precio sobre la marcha
            const product = await stripe.products.create({
              name: extra.name,
            });
            const price = await stripe.prices.create({
              unit_amount: extra.price * 100, // Convertir a centavos
              currency: 'mxn',
              product: product.id,
            });
            extraPriceId = price.id;
        }
        
        lineItems.push({
          price: extraPriceId,
          quantity: 1,
        });
      }
    }
    
    // El modo es SIEMPRE 'subscription' porque siempre hay suscripción
    
    // Crear sesión de Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription', // Siempre subscription porque siempre hay suscripción
      success_url: `${process.env.APP_URL || 'http://localhost:3000'}/success.html?order=${ordenNumero}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/compra.html?error=payment_cancelled`,
      customer_email: orderData.customer.email,
      metadata: {
        orderId: orderId.toString(),
        orderNumber: ordenNumero,
        customerId: customerId.toString()
      }
    });

    console.log(`✅ Sesión de Stripe creada: ${session.id}`);
    console.log(`🔗 URL de checkout: ${session.url}`);

    // Actualizar pedido con session_id
    db.run(
      'UPDATE pedidos SET stripe_session_id = ? WHERE id = ?',
      [session.id, orderId],
      function(err) {
        if (err) console.error('Error actualizando session_id:', err);
      }
    );

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
    console.error('❌ Error creando pedido:', error);
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
        <h3>🔄 Siguiente Paso</h3>
        <p>Serás redirigido a <strong>Stripe</strong> para completar tu pago de forma segura:</p>
        <ul>
          ${subscription ? '<li><strong>Suscripción mensual</strong> - Se procesará automáticamente cada mes</li>' : ''}
          ${extras.length > 0 ? '<li><strong>Productos adicionales</strong> - Pago único</li>' : ''}
        </ul>
        <p>Una vez que completes el pago en Stripe, tendrás acceso inmediato a tus productos.</p>
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

// Endpoint para estadísticas del admin
app.get('/api/admin/stats', (req, res) => {
  const queries = [
    'SELECT COUNT(*) as total FROM pedidos',
    'SELECT COUNT(*) as completed FROM pedidos WHERE estado = "completed"',
    'SELECT COUNT(*) as pending FROM pedidos WHERE estado = "pending"',
    'SELECT SUM(total_recurrente + total_unico) as revenue FROM pedidos WHERE estado = "completed"'
  ];
  
  const results = {};
  let completed = 0;
  
  queries.forEach((query, index) => {
    db.get(query, [], (err, row) => {
      if (err) {
        console.error('Error en estadística:', err);
        return;
      }
      
      switch(index) {
        case 0: results.total = row.total || 0; break;
        case 1: results.completed = row.completed || 0; break;
        case 2: results.pending = row.pending || 0; break;
        case 3: results.revenue = row.revenue || 0; break;
      }
      
      completed++;
      if (completed === queries.length) {
        res.json(results);
      }
    });
  });
});

// Webhook de Stripe para notificaciones de pago
app.post('/api/webhooks/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  let event;

  try {
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    console.log('🔔 Webhook recibido de Stripe:', event.type);
    
    // Procesar eventos de Stripe
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      console.log('✅ Checkout session completado:', session.id);
      
      // Obtener metadatos del pedido
      const { orderId, orderNumber } = session.metadata;
      
      if (orderId && orderNumber) {
        // Actualizar estado del pedido en la base de datos
        db.run(
          'UPDATE pedidos SET estado = ?, stripe_session_id = ?, fecha_pago = CURRENT_TIMESTAMP WHERE id = ?',
          ['completed', session.id, orderId],
          async function(err) {
            if (err) {
              console.error('❌ Error actualizando pedido:', err);
            } else {
              console.log('✅ Pedido actualizado:', orderNumber);
              
              // Obtener datos del pedido para enviar correo
              try {
                const order = await new Promise((resolve, reject) => {
                  db.get(`
                    SELECT p.*, c.nombre, c.apellido, c.email
                    FROM pedidos p
                    JOIN customers c ON p.customer_id = c.id
                    WHERE p.id = ?
                  `, [orderId], (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                  });
                });

                if (order && order.datos_originales) {
                  const orderData = JSON.parse(order.datos_originales);
                  console.log('📧 Enviando correo de confirmación...');
                  await sendConfirmationEmail(orderData, orderNumber);
                }
              } catch (emailError) {
                console.error('❌ Error enviando correo:', emailError);
              }
            }
          }
        );
      }
    } else if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object;
      console.log('💰 Pago de factura exitoso:', invoice.id);
      // Aquí puedes manejar pagos recurrentes de suscripciones
    }

    res.status(200).send('Webhook processed');
  } catch (err) {
    console.error('❌ Error procesando webhook de Stripe:', err);
    res.status(400).send('Webhook error: ' + err.message);
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
    
    // Con Stripe es simple: completed = pagado, pending = pendiente
    const isPaid = order.estado === 'completed';
    
    console.log(`📊 Consultando estado de ${orderNumber}:`, {
      estado: order.estado,
      isPaid: isPaid
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
      isPaid: isPaid,
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
      console.log(`💳 Stripe: ✅ Sistema de pagos configurado`);
      console.log(`\n🎯 ¡Todo listo para recibir pedidos!`);
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