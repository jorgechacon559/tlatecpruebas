# 🚀 Guía de Instalación y Configuración

## 📋 Prerrequisitos

### 1. Software Necesario
- **Node.js** (versión 16 o superior): https://nodejs.org/
- **PostgreSQL** (versión 12 o superior): https://www.postgresql.org/download/
- **Git** (opcional): https://git-scm.com/

### 2. Cuentas de Servicios
- **Cuenta de MercadoPago Developer**: https://developers.mercadopago.com/
- **Cuenta de Gmail** (para envío de correos) o servicio SMTP alternativo

## 🔧 Configuración Paso a Paso

### Paso 1: Instalar PostgreSQL

1. **Descarga e instala PostgreSQL** desde el sitio oficial
2. Durante la instalación, recuerda la contraseña del usuario `postgres`
3. **Crear la base de datos**:
   ```sql
   -- Conectarse a PostgreSQL como usuario postgres
   psql -U postgres
   
   -- Crear la base de datos (opcional, el script lo hace automáticamente)
   CREATE DATABASE suscripciones_db;
   ```

### Paso 2: Configurar Gmail para envío de correos

1. **Habilitar autenticación de 2 factores** en tu cuenta de Gmail
2. **Generar una contraseña de aplicación**:
   - Ve a tu cuenta de Google → Seguridad
   - Autenticación en 2 pasos → Contraseñas de aplicaciones
   - Selecciona "Correo" y "Equipo Windows/Mac/Linux"
   - Copia la contraseña generada (será algo como: `abcd efgh ijkl mnop`)

### Paso 3: Configurar MercadoPago

1. **Registrarse en MercadoPago Developers**: https://developers.mercadopago.com/
2. **Crear una aplicación**:
   - Panel → Tus aplicaciones → Crear aplicación
   - Modelo de integración: "Pagos online y presenciales"
3. **Obtener credenciales**:
   - Public Key (para frontend)
   - Access Token (para backend)
4. **Configurar webhooks** (opcional para pruebas):
   - URL: `http://tu-dominio.com/api/webhooks/mercadopago`
   - Eventos: `payment`, `subscription_preapproval`

### Paso 4: Instalar y configurar el proyecto

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Configurar variables de entorno**:
   Edita el archivo `.env` con tus datos reales:
   ```env
   # Base de Datos PostgreSQL
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=suscripciones_db
   DB_PASSWORD=tu_contraseña_postgresql
   DB_PORT=5432

   # Email (Gmail)
   EMAIL_USER=tu_email@gmail.com
   EMAIL_PASS=abcd_efgh_ijkl_mnop  # Contraseña de aplicación de Gmail

   # MercadoPago
   MERCADOPAGO_ACCESS_TOKEN=APP_USR-1234567890abcdef
   MERCADOPAGO_PUBLIC_KEY=APP_USR-abcdef1234567890

   # Servidor
   PORT=3000
   BASE_URL=http://localhost:3000
   ```

3. **Configurar la base de datos**:
   ```bash
   node setup-db.js
   ```

4. **Iniciar el servidor**:
   ```bash
   # Modo desarrollo (con auto-restart)
   npm run dev
   
   # O modo producción
   npm start
   ```

### Paso 5: Verificar funcionamiento

1. **Abrir el navegador** en: http://localhost:3000/compra.html
2. **Realizar una prueba completa**:
   - Seleccionar suscripción
   - Agregar producto extra
   - Llenar formulario con un email real
   - Procesar el pedido
3. **Verificar**:
   - Base de datos se actualiza
   - Correo de confirmación llega
   - Enlaces de MercadoPago funcionan

## 🔍 Verificación de Instalación

### Verificar Base de Datos
```sql
-- Conectarse a la base de datos
psql -U postgres -d suscripciones_db

-- Verificar tablas creadas
\dt

-- Ver algunos datos
SELECT * FROM customers;
SELECT * FROM pedidos;
```

### Verificar API
```bash
# Verificar que el servidor esté corriendo
curl http://localhost:3000/api/health

# Debería responder:
# {"status":"OK","timestamp":"2024-01-01T00:00:00.000Z"}
```

### Verificar Email
- Realizar un pedido de prueba
- Verificar que llegue el correo de confirmación
- Revisar la carpeta de spam si no aparece en la bandeja principal

## 🔧 Solución de Problemas Comunes

### Error: "relation does not exist"
```bash
# Ejecutar nuevamente el script de configuración
node setup-db.js
```

### Error: "Authentication failed" (PostgreSQL)
- Verificar usuario y contraseña en `.env`
- Asegurarse de que PostgreSQL esté ejecutándose
- Verificar el puerto (por defecto 5432)

### Error: "Invalid login" (Gmail)
- Verificar que tengas autenticación de 2 factores habilitada
- Usar contraseña de aplicación, NO tu contraseña normal de Gmail
- Verificar que el email sea correcto

### Los correos no llegan
- Verificar configuración SMTP en `.env`
- Revisar la carpeta de spam
- Verificar logs del servidor para errores de email

### MercadoPago no funciona
- Verificar que los enlaces sean correctos y estén activos
- Asegurarse de usar las credenciales correctas
- Verificar que la aplicación de MercadoPago esté configurada

## 📦 Despliegue en Producción

### Variables de Entorno de Producción
```env
NODE_ENV=production
DB_HOST=tu-servidor-postgresql.com
BASE_URL=https://tu-dominio.com
# ... resto de configuración
```

### Servicio de Base de Datos
Recomendaciones:
- **Heroku Postgres** (fácil configuración)
- **AWS RDS** (PostgreSQL)
- **Digital Ocean Managed Database**
- **Neon.tech** (PostgreSQL serverless)

### Servicio de Email
Alternativas a Gmail:
- **SendGrid** (recomendado para producción)
- **Mailgun**
- **AWS SES**
- **Resend**

## 🔒 Seguridad

### Para Producción
1. **Usar HTTPS** en todos los endpoints
2. **Validar todos los inputs** del lado del servidor
3. **Configurar CORS** apropiadamente
4. **Usar variables de entorno seguras**
5. **Implementar rate limiting**
6. **Logs de auditoría**

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs del servidor
2. Verifica la configuración en `.env`
3. Asegúrate de que todos los servicios estén ejecutándose
4. Consulta la documentación de MercadoPago

¡Tu sistema de suscripciones está listo para funcionar! 🎉
