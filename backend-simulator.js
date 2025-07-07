// Backend Simulator para el sistema de suscripciones
// Este archivo simula cómo funcionaría el backend real

class OrderManager {
  constructor() {
    this.orders = JSON.parse(localStorage.getItem('orders') || '[]');
    this.customers = JSON.parse(localStorage.getItem('customers') || '[]');
  }

  // Crear nuevo pedido
  createOrder(orderData) {
    const order = {
      id: 'ORD-' + Date.now(),
      timestamp: new Date().toISOString(),
      customer: orderData.customer,
      subscription: orderData.subscription,
      extras: orderData.extras,
      status: {
        subscription: 'pending',
        extras: 'pending'
      },
      payments: {
        subscriptionPaymentId: null,
        extrasPaymentIds: []
      }
    };

    this.orders.push(order);
    this.saveOrders();
    return order;
  }

  // Actualizar estado de pago
  updatePaymentStatus(orderId, paymentType, status, paymentId = null) {
    const order = this.orders.find(o => o.id === orderId);
    if (order) {
      order.status[paymentType] = status;
      if (paymentId) {
        if (paymentType === 'subscription') {
          order.payments.subscriptionPaymentId = paymentId;
        } else {
          order.payments.extrasPaymentIds.push(paymentId);
        }
      }
      this.saveOrders();
      this.sendStatusEmail(order);
    }
  }

  // Enviar email de confirmación
  sendConfirmationEmail(order) {
    const emailTemplate = this.generateEmailTemplate(order);
    
    // Simular envío de email
    console.log('📧 Enviando email de confirmación a:', order.customer.email);
    console.log('Contenido del email:', emailTemplate);
    
    // En un entorno real, aquí integrarías con un servicio de email
    // como SendGrid, Mailgun, etc.
    return this.simulateEmailSend(order.customer.email, emailTemplate);
  }

  // Enviar email de actualización de estado
  sendStatusEmail(order) {
    if (order.status.subscription === 'completed' && 
        order.status.extras === 'completed') {
      
      const emailTemplate = this.generateCompletionEmailTemplate(order);
      console.log('📧 Enviando email de completación a:', order.customer.email);
      console.log('Contenido:', emailTemplate);
    }
  }

  // Generar template de email
  generateEmailTemplate(order) {
    const subscriptionInfo = order.subscription ? 
      `Suscripción: ${order.subscription.name} - $${order.subscription.price} MXN/mes` : '';
    
    const extrasInfo = order.extras.length > 0 ?
      order.extras.map(item => `${item.name} - $${item.price} MXN`).join('\n') : '';

    return `
Hola ${order.customer.nombre},

¡Gracias por tu pedido!

DETALLES DEL PEDIDO:
-------------------
Número de pedido: ${order.id}
Fecha: ${new Date(order.timestamp).toLocaleDateString('es-MX')}

${subscriptionInfo}
${extrasInfo}

INFORMACIÓN DE PAGO:
-------------------
Los pagos están siendo procesados a través de MercadoPago.
Recibirás una confirmación adicional una vez que todos los pagos sean completados.

PRÓXIMOS PASOS:
--------------
1. Confirma tus pagos en las páginas de MercadoPago que se abrieron
2. Recibirás acceso a tu suscripción dentro de las próximas 24 horas
3. Los productos adicionales se activarán inmediatamente después del pago

Si tienes alguna pregunta, no dudes en contactarnos.

¡Gracias por elegirnos!

Equipo de Soporte
    `;
  }

  generateCompletionEmailTemplate(order) {
    return `
Hola ${order.customer.nombre},

¡Excelentes noticias! Todos tus pagos han sido confirmados.

Tu suscripción está ahora ACTIVA y tienes acceso completo a todos los beneficios.
Los productos adicionales también han sido activados en tu cuenta.

Puedes acceder a tu panel de usuario en: [LINK_PANEL_USUARIO]

¡Disfruta de tu suscripción!

Equipo de Soporte
    `;
  }

  // Simular envío de email
  simulateEmailSend(email, content) {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`✅ Email enviado exitosamente a ${email}`);
        resolve(true);
      }, 1000);
    });
  }

  // Webhook simulator for MercadoPago
  handleMercadoPagoWebhook(webhookData) {
    console.log('🔗 Webhook recibido de MercadoPago:', webhookData);
    
    // Simular procesamiento del webhook
    const { payment_id, status, external_reference } = webhookData;
    
    if (status === 'approved') {
      // Buscar el pedido por referencia externa
      const order = this.orders.find(o => o.id === external_reference);
      if (order) {
        // Determinar si es suscripción o extra
        if (webhookData.subscription_id) {
          this.updatePaymentStatus(order.id, 'subscription', 'completed', payment_id);
        } else {
          this.updatePaymentStatus(order.id, 'extras', 'completed', payment_id);
        }
      }
    }
  }

  // Obtener todos los pedidos
  getAllOrders() {
    return this.orders;
  }

  // Obtener pedidos por cliente
  getOrdersByCustomer(email) {
    return this.orders.filter(order => order.customer.email === email);
  }

  // Guardar pedidos en localStorage (simula base de datos)
  saveOrders() {
    localStorage.setItem('orders', JSON.stringify(this.orders));
  }

  // Integración con MercadoPago (simulada)
  createMercadoPagoPreference(orderData) {
    // Simular creación de preferencia en MercadoPago
    const preference = {
      id: 'MP-PREF-' + Date.now(),
      init_point: 'https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=MP-PREF-' + Date.now(),
      external_reference: orderData.id,
      items: orderData.extras.map(item => ({
        title: item.name,
        unit_price: item.price,
        quantity: 1
      }))
    };

    console.log('💳 Preferencia de MercadoPago creada:', preference);
    return preference;
  }
}

// Inicializar el manager
const orderManager = new OrderManager();

// Simular algunos pedidos de ejemplo (solo para testing)
if (orderManager.getAllOrders().length === 0) {
  console.log('📝 Inicializando con datos de ejemplo...');
  
  const exampleOrder = {
    customer: {
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'juan.perez@example.com'
    },
    subscription: {
      id: 'sub1',
      name: 'Paquete Premium',
      price: 10,
      type: 'subscription'
    },
    extras: [
      {
        id: 'extra1',
        name: 'Producto Extra Premium',
        price: 50,
        type: 'extra'
      }
    ]
  };

  orderManager.createOrder(exampleOrder);
}

// Exportar para uso global
window.OrderManager = OrderManager;
window.orderManager = orderManager;
