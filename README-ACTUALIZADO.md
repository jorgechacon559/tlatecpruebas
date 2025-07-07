# 🛒 Sistema de Suscripciones y Productos - Actualizado

## 📦 **PAQUETES DE SUSCRIPCIÓN** (Solo uno seleccionable)

### 🥉 **Paquete Premium** - $10 MXN/mes
- **URL**: `https://mienlace1.com` (reemplazar con tu enlace de MP)
- **Descripción**: Perfecto para comenzar. Accede a beneficios exclusivos con nuestra suscripción mensual básica.

### 🥈 **Paquete Intermedio** - $25 MXN/mes  
- **URL**: `https://mienlace2.com` (reemplazar con tu enlace de MP)
- **Descripción**: Mayor valor y funcionalidades. Ideal para usuarios que buscan más beneficios y herramientas avanzadas.

### 🥇 **Paquete Avanzado** - $50 MXN/mes
- **URL**: `https://mienlace3.com` (reemplazar con tu enlace de MP)
- **Descripción**: La experiencia completa. Acceso total a todas las funciones premium y soporte prioritario.

## 🎁 **PRODUCTOS EXTRA** (Múltiples seleccionables)

### 💎 **Producto Extra Premium** - $50 MXN
- **URL**: `https://mpago.la/33sgGGY` (ya configurado)
- **Descripción**: Complemento premium para potenciar tu experiencia. Incluye funciones avanzadas y contenido exclusivo.

### 📄 **Pack de Plantillas** - $30 MXN
- **URL**: Por configurar (se genera dinámicamente)
- **Descripción**: Colección de plantillas profesionales listas para usar. Ahorra tiempo y obtén resultados profesionales.

### 🎓 **Curso Avanzado** - $75 MXN
- **URL**: Por configurar (se genera dinámicamente)
- **Descripción**: Curso completo con certificación incluida. Aprende técnicas avanzadas de la mano de expertos.

### 🛠️ **Kit de Recursos** - $25 MXN
- **URL**: Por configurar (se genera dinámicamente)
- **Descripción**: Conjunto de herramientas y recursos adicionales. Incluye guías, checklists y material de apoyo.

## 🔧 **CÓMO CONFIGURAR TUS ENLACES DE MERCADOPAGO**

### Para Suscripciones:
1. Ve a tu panel de MercadoPago
2. Crea planes de suscripción para cada paquete
3. Reemplaza en `compra.html` las URLs:
   - `https://mienlace1.com` → Tu URL del Paquete Premium
   - `https://mienlace2.com` → Tu URL del Paquete Intermedio  
   - `https://mienlace3.com` → Tu URL del Paquete Avanzado

### Para Productos Extra:
- **Producto Extra Premium**: Ya tiene URL real configurada
- **Los otros 3 productos**: Se generan automáticamente con la API de MercadoPago

## 🎯 **FLUJO DE COMPRA**

1. **Cliente selecciona UN paquete** (obligatorio)
2. **Cliente selecciona productos extra** (opcional, pueden ser varios)
3. **Cliente llena sus datos** (nombre, apellido, email)
4. **Se abren ventanas de pago**:
   - Una para la suscripción (recurrente)
   - Una para productos extra (pago único) - si seleccionó alguno
5. **Después del pago**: Se confirma y envía correo

## 📊 **EJEMPLO DE PEDIDO**

```json
{
  "customer": {
    "nombre": "Juan",
    "apellido": "Pérez", 
    "email": "juan@ejemplo.com"
  },
  "subscription": {
    "name": "Paquete Intermedio",
    "price": 25
  },
  "extras": [
    {"name": "Pack de Plantillas", "price": 30},
    {"name": "Curso Avanzado", "price": 75}
  ]
}
```

**Total**: $25 MXN/mes + $105 MXN pago único

## 🚀 **PARA USAR**

1. **Inicia el servidor**: `npm start`
2. **Ve al carrito**: http://localhost:3000/compra.html
3. **Configura tus URLs** de MercadoPago en `compra.html`
4. **¡Listo para vender!** 

El sistema maneja automáticamente las URLs dinámicas para productos extra usando la API de MercadoPago.
