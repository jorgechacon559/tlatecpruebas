const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const mercadopago = require('mercadopago');
require('dotenv').config();

// Configuración de MercadoPago
mercadopago.configure({
  access_token: process.env.MERCADOPAGO_ACCESS_TOKEN
});

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

    // Crear URLs de pago
    const paymentUrls = {};
    
    // 1. URL de suscripción (según el paquete seleccionado)
    if (orderData.subscription) {
      let subscriptionBaseUrl = orderData.subscription.url;
      
      // Si la URL está vacía o es placeholder, usar URL por defecto
      if (!subscriptionBaseUrl || subscriptionBaseUrl.includes('mienlace')) {
        subscriptionBaseUrl = process.env.MERCADOPAGO_SUBSCRIPTION_URL || 'https://mienlace1.com';
      }
      
      const successUrl = encodeURIComponent(`${process.env.APP_URL || 'http://localhost:3000'}/order-status.html?order=${ordenNumero}&type=subscription`);
      const failureUrl = encodeURIComponent(`${process.env.APP_URL || 'http://localhost:3000'}/compra.html?error=payment_failed`);
      
      // Si es una URL real de MercadoPago, agregar parámetros de retorno
      if (subscriptionBaseUrl.includes('mercadopago.com')) {
        paymentUrls.subscriptionUrl = `${subscriptionBaseUrl}&back_url_success=${successUrl}&back_url_failure=${failureUrl}`;
      } else {
        // Para URLs placeholder, solo guardar la URL base (el usuario la reemplazará)
        paymentUrls.subscriptionUrl = subscriptionBaseUrl;
      }
    }
    
    // 2. URL de productos extras (dinámica via MercadoPago API)
    if (orderData.extras && orderData.extras.length > 0) {
      const preferenceData = {
        items: orderData.extras.map(item => ({
          title: item.name,
          unit_price: item.price,
          quantity: 1,
          currency_id: 'MXN'
        })),
        payer: {
          name: orderData.customer.nombre,
          surname: orderData.customer.apellido,
          email: orderData.customer.email
        },
        external_reference: ordenNumero,
        back_urls: {
          success: `${process.env.APP_URL || 'http://localhost:3000'}/order-status.html?order=${ordenNumero}&type=extras`,
          failure: `${process.env.APP_URL || 'http://localhost:3000'}/compra.html?error=payment_failed`,
          pending: `${process.env.APP_URL || 'http://localhost:3000'}/compra.html?status=pending`
        },
        notification_url: `${process.env.APP_URL || 'http://localhost:3000'}/api/webhooks/mercadopago`
      };

      console.log('🔍 Creando preferencia con datos:', JSON.stringify(preferenceData, null, 2));
      
      const response = await mercadopago.preferences.create(preferenceData);
      paymentUrls.extrasUrl = response.body.init_point;
      
      console.log('✅ Preferencia de MercadoPago creada:', response.body.id);
      console.log('🔗 URL generada:', response.body.init_point);
    }
    
    res.json({
      success: true,
      orderId: orderId,
      orderNumber: ordenNumero,
      customerId: customerId,
      paymentUrls: paymentUrls,
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
        <p>Se han abierto las páginas de <strong>MercadoPago</strong> para completar tus pagos:</p>
        <ul>
          ${subscription ? '<li><strong>Suscripción mensual</strong> - Se procesará automáticamente cada mes</li>' : ''}
          ${extras.length > 0 ? '<li><strong>Productos adicionales</strong> - Pago único</li>' : ''}
        </ul>
        <p>Una vez que completes los pagos en MercadoPago, tendrás acceso inmediato a tus productos.</p>
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

// Webhook de MercadoPago para notificaciones de pago
app.post('/api/webhooks/mercadopago', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    const notification = req.body;
    console.log('🔔 Webhook recibido de MercadoPago:', notification);
    
    // Procesar notificaciones de pago
    if (notification.type === 'payment' && notification.data && notification.data.id) {
      const paymentId = notification.data.id;
      console.log('💳 Procesando pago ID:', paymentId);
      
      try {
        // Consultar detalles del pago desde MercadoPago API
        const paymentResponse = await mercadopago.payment.findById(paymentId);
        const payment = paymentResponse.body;
        
        console.log('📋 Detalles del pago:', {
          id: payment.id,
          status: payment.status,
          external_reference: payment.external_reference,
          transaction_amount: payment.transaction_amount
        });
        
        if (payment.status === 'approved' && payment.external_reference) {
          const orderNumber = payment.external_reference;
          
          // Determinar tipo de pago basado en el contexto
          // Para productos extras, el external_reference viene del checkout dinámico
          const paymentType = 'extras'; // Los webhooks generalmente son para extras
          
          // Simular llamada al endpoint de confirmación
          const confirmationData = {
            orderNumber: orderNumber,
            paymentType: paymentType,
            paymentId: payment.id,
            status: payment.status
          };
          
          console.log('🔄 Confirmando pago automáticamente:', confirmationData);
          
          // Llamar a la lógica de confirmación directamente
          await processPaymentConfirmation(confirmationData);
        }
        
      } catch (mpError) {
        console.error('❌ Error consultando pago en MercadoPago:', mpError);
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error procesando webhook:', error);
    res.status(500).send('Error');
  }
});

// Función auxiliar para procesar confirmación de pago
async function processPaymentConfirmation({ orderNumber, paymentType, paymentId, status }) {
  try {
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
    if (status !== 'approved') {
      console.log(`⚠️ Pago no aprobado para pedido ${orderNumber}: ${status}`);
      return;
    }

    // Actualizar el estado específico del tipo de pago
    const updateField = paymentType === 'subscription' ? 'subscription_paid = 1' : 'extras_paid = 1';
    
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE pedidos SET ${updateField}, payment_id_${paymentType} = ? WHERE orden_numero = ?`,
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
      console.log(`💳 MercadoPago: ✅ Enlaces directos funcionando`);
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