# 🔧 Configuración Simplificada - Solo lo Esencial

Como ya tienes tus enlaces directos de MercadoPago funcionando, solo necesitas configurar 2 cosas:

## 1. 🗄️ PostgreSQL (Base de Datos)

### Instalar PostgreSQL:
1. Descargar de: https://www.postgresql.org/download/windows/
2. Durante la instalación, establecer una contraseña para el usuario `postgres`
3. Recordar esa contraseña (la necesitarás)

### Configurar en .env:
```env
DB_PASSWORD=la_contraseña_que_pusiste_en_postgresql
```

## 2. 📧 Gmail (Envío de Correos)

### Configurar Gmail:
1. **Habilitar autenticación de 2 factores** en tu Gmail
2. **Generar contraseña de aplicación**:
   - Ve a tu cuenta de Google → Seguridad
   - Autenticación en 2 pasos → Contraseñas de aplicaciones
   - Selecciona "Correo" y "Otro (nombre personalizado)"
   - Escribe "Sistema Suscripciones"
   - Copia la contraseña de 16 caracteres que aparece

### Configurar en .env:
```env
EMAIL_USER=tu_email_real@gmail.com
EMAIL_PASS=la_contraseña_de_16_caracteres_aqui
```

## 🚀 ¡Eso es Todo!

Con solo esas 3 líneas configuradas, tu sistema funcionará perfectamente:

### Tu .env final debe verse así:
```env
# Base de Datos
DB_PASSWORD=tu_contraseña_postgresql

# Email  
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop

# El resto se queda igual
```

## ✅ ¿Por qué NO necesitas API de MercadoPago?

- **Tus enlaces ya funcionan**: `https://www.mercadopago.com.mx/subscriptions/...` y `https://mpago.la/33sgGGY`
- **Los pagos se procesan directamente** en MercadoPago
- **Tu sistema solo registra** quién compró qué y envía confirmaciones
- **Las APIs son solo para funciones avanzadas** como webhooks automáticos

## 🧪 Probar que Todo Funciona

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Configurar base de datos**:
   ```bash
   node setup-db.js
   ```

3. **Probar sistema**:
   ```bash
   npm test
   ```

4. **Iniciar servidor**:
   ```bash
   npm start
   ```

5. **Abrir**: http://localhost:3000/compra.html

## 🎯 Flujo Funcional Sin API:

1. Cliente llena formulario → **Se guarda en PostgreSQL**
2. Cliente hace clic en "Proceder al Pago" → **Se abre tu enlace de MercadoPago**
3. Cliente paga en MercadoPago → **Pago se procesa directamente**
4. Sistema envía correo de confirmación → **Con Gmail configurado**

¡No necesitas nada más! 🎉
