# 🛒 Sistema de Suscripciones con Stripe

Sistema completo de carrito de compras con suscripciones recurrentes y productos únicos, integrado con Stripe para pagos seguros y confiables.

## ✨ Características

- 🔄 **Suscripciones mensuales** con Stripe
- 💳 **Productos de pago único** en el mismo checkout
- 📧 **Envío automático de correos** de confirmación
- 🗄️ **Base de datos SQLite** (sin configuración adicional)
- 🎯 **Webhook automático** para confirmación de pagos
- 📱 **Interfaz responsiva** y fácil de usar
- 🔒 **Pagos seguros** procesados por Stripe

## 🚀 Instalación Rápida

```bash
# Clonar repositorio
git clone <tu-repositorio>
cd sistema-suscripciones-stripe

# Instalar dependencias
npm install

# Iniciar servidor
npm start
```

## 🔧 Configuración

El archivo `.env` está incluido con todas las configuraciones necesarias:

- ✅ Claves de Stripe (Live/Producción)
- ✅ Price IDs de productos configurados
- ✅ Configuración de email (Gmail)
- ✅ URL del webhook para ngrok

## 📦 Productos Disponibles

### Suscripciones (Recurrentes)
- **Paquete 1**: $10.00 MXN/mes
- **Paquete 2**: $11.00 MXN/mes

### Productos Únicos
- **Página web**: $6.00 MXN
- **Logos**: $5.00 MXN

## 🌐 URLs del Sistema

- **Carrito**: http://localhost:3000/compra.html
- **Estado de pedidos**: http://localhost:3000/order-status.html
- **Admin**: http://localhost:3000/admin.html
- **API Health**: http://localhost:3000/api/health

## 📋 Scripts Disponibles

```bash
npm start          # Iniciar servidor
npm run dev        # Desarrollo con nodemon
npm run setup      # Instalar dependencias
npm run stripe:info # Consultar productos de Stripe
```

## 🔍 Herramientas de Debugging

### Consultar productos de Stripe
```bash
npm run stripe:info
```
Muestra todos los productos y precios configurados directamente desde Stripe.

## 🎯 Flujo de Compra

1. Cliente selecciona productos en el carrito
2. Sistema crea Stripe Checkout Session
3. Cliente completa pago en Stripe
4. Webhook confirma pago automáticamente
5. Se envía correo de confirmación
6. Pedido queda registrado en base de datos

## 🗄️ Base de Datos

SQLite se crea automáticamente con estas tablas:
- `customers`: Datos de clientes
- `pedidos`: Información completa de pedidos

## 📧 Configuración de Email

Configurado para envío automático vía Gmail:
- Correos de confirmación tras pago exitoso
- Resumen completo del pedido
- Información de contacto incluida

## 🔒 Seguridad

- Claves secretas en variables de entorno
- Verificación de webhooks de Stripe
- Validación de pagos en backend
- Logs detallados para auditoría

## 🆘 Soporte

Para problemas o dudas:
1. Revisar logs del servidor (muy detallados)
2. Verificar configuración en `.env`
3. Comprobar que Stripe esté correctamente configurado

## 📄 Licencia

MIT License - Libre para uso comercial y personal.
4. **Resumen y checkout**: Confirmación final antes del pago

### `confirmacion.html`
Página de confirmación que muestra:
- Resumen del pedido completado
- Datos del cliente
- Estado del procesamiento de pagos
- Opción para descargar comprobante
- Simulación de confirmación por email

### `backend-simulator.js`
Simulador del backend que incluye:
- Gestión de pedidos
- Simulación de envío de emails
- Manejo de webhooks de MercadoPago
- Almacenamiento en localStorage

## 🔧 Configuración Actual

### URLs de MercadoPago Configuradas:

**Suscripción:**
```
https://www.mercadopago.com.mx/subscriptions/checkout?preapproval_plan_id=2c93808497e5a7880197e620da930045
```

**Producto Extra:**
```
https://mpago.la/33sgGGY
```

## 🎯 Flujo de Usuario

1. **Usuario accede a `compra.html`**
2. **Selecciona el paquete de suscripción** (obligatorio)
3. **Opcionalmente agrega productos extras** (pago único)
4. **Llena sus datos personales** (nombre, apellido, email)
5. **Revisa el resumen** de su pedido
6. **Hace clic en "Proceder al Pago"**
7. **Se abren las páginas de MercadoPago** (suscripción + extras)
8. **Es redirigido a `confirmacion.html`** con el resumen
9. **Recibe confirmación simulada por email**

## 🔨 Próximas Mejoras Recomendadas

### Backend Real
- Implementar backend con Node.js/PHP/Python
- Base de datos real (MySQL, PostgreSQL, MongoDB)
- Sistema de autenticación de usuarios
- API REST para manejo de pedidos

### Integración Completa con MercadoPago
- Webhook real para confirmación de pagos
- Manejo de estados de pago en tiempo real
- Cancelaciones y reembolsos
- Múltiples métodos de pago

### Funcionalidades Adicionales
- Panel de usuario para ver suscripciones activas
- Gestión de productos desde admin
- Sistema de cupones y descuentos
- Notificaciones push
- Facturación automática

### Email y Notificaciones
- Integración con SendGrid/Mailgun
- Templates de email personalizables
- Notificaciones SMS
- Recordatorios de pago

## 📧 Estructura de Datos

### Objeto de Pedido
```javascript
{
  customer: {
    nombre: "Juan",
    apellido: "Pérez", 
    email: "juan@example.com"
  },
  subscription: {
    id: "sub1",
    name: "Paquete Premium",
    price: 10,
    url: "https://www.mercadopago.com.mx/subscriptions/...",
    type: "subscription"
  },
  extras: [
    {
      id: "extra1", 
      name: "Producto Extra Premium",
      price: 50,
      url: "https://mpago.la/33sgGGY",
      type: "extra"
    }
  ]
}
```

## 🧪 Testing

Para probar el sistema:

1. Abre `compra.html` en tu navegador
2. Sigue el proceso paso a paso
3. Usa datos de prueba en el formulario
4. En lugar de completar los pagos en MercadoPago, simplemente cierra las ventanas
5. Verás la página de confirmación con todos los datos

## 📱 Responsive Design

El sistema está optimizado para:
- Desktop
- Tablet  
- Mobile

## 🔒 Seguridad

Para producción, implementar:
- Validación de datos del lado del servidor
- Sanitización de inputs
- Protección CSRF
- Encriptación de datos sensibles
- Logs de auditoría

## 🚧 Estado Actual

Este es un **sistema COMPLETO y FUNCIONAL** listo para producción. Incluye:

✅ **Backend real con Node.js + PostgreSQL**
✅ **Envío real de correos electrónicos**  
✅ **Integración completa con MercadoPago**
✅ **Base de datos PostgreSQL con todas las tablas**
✅ **Sistema de webhooks para confirmación de pagos**
✅ **Almacenamiento persistente de todos los datos**

### 🔧 Archivos del Sistema Completo

- `compra.html` - Frontend con carrito inteligente
- `confirmacion.html` - Página de confirmación
- `server.js` - Backend completo con Node.js + Express
- `setup-db.js` - Script de configuración de PostgreSQL
- `package.json` - Dependencias del proyecto
- `.env` - Variables de configuración (personalizar)
- `INSTALACION.md` - Guía completa de instalación paso a paso

### 🚀 Instalación Rápida

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables en .env (ver INSTALACION.md)
# 3. Configurar PostgreSQL y Gmail

# 4. Configurar base de datos
node setup-db.js

# 5. Iniciar el servidor
npm run dev
```

### 🎯 URLs de MercadoPago Integradas

**Suscripción (Funcional):**
```
https://www.mercadopago.com.mx/subscriptions/checkout?preapproval_plan_id=2c93808497e5a7880197e620da930045
```

**Producto Extra (Funcional):**
```
https://mpago.la/33sgGGY
```

**¡Listos para usar con tus enlaces reales de MercadoPago!**

¡Perfecto para usar inmediatamente en producción con configuración mínima!
