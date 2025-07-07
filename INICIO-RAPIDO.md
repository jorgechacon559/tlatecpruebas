# 🚀 Instalación Ultra Rápida - Sin PostgreSQL

## ✅ **Solo 2 Pasos Para Funcionar**

### Paso 1: Configurar Gmail (2 minutos)

1. **Ve a tu cuenta de Google** → Seguridad
2. **Habilita autenticación de 2 factores** (si no la tienes)
3. **Crea contraseña de aplicación**:
   - Autenticación en 2 pasos → Contraseñas de aplicaciones
   - Selecciona "Correo" y "Otro"
   - Escribe "Sistema Suscripciones" 
   - **Copia la contraseña de 16 caracteres** (ej: `abcd efgh ijkl mnop`)

4. **Edita el archivo `.env`**:
   ```env
   EMAIL_USER=tu_email_real@gmail.com
   EMAIL_PASS=abcd efgh ijkl mnop
   ```

### Paso 2: Instalar y Ejecutar (1 minuto)

```bash
# Instalar dependencias
npm install

# Iniciar el sistema
npm start
```

## 🎉 **¡Ya Está Funcionando!**

- **Carrito**: http://localhost:3000/compra.html
- **Admin**: http://localhost:3000/admin.html

## 💡 **Ventajas de Esta Solución:**

✅ **Sin PostgreSQL** - Usa SQLite (se crea automáticamente)  
✅ **Sin configuración compleja** - Solo Gmail  
✅ **Carrito unificado** - Distingue pagos recurrentes vs únicos  
✅ **Correos automáticos** - Con desglose completo  
✅ **Panel de admin** - Para ver todos los pedidos  
✅ **Enlaces reales** - Tus URLs de MercadoPago ya integradas  

## 🛒 **Cómo Funciona el Carrito Unificado:**

1. **Cliente selecciona**:
   - ✅ Suscripción mensual ($10 MXN/mes)
   - ✅ Producto extra ($50 MXN único)

2. **Sistema procesa**:
   - 📝 Guarda todo en base de datos SQLite
   - 📧 Envía correo con desglose completo
   - 🔗 Abre enlaces de MercadoPago separados

3. **Cliente paga**:
   - 💳 Suscripción en MercadoPago (recurrente)
   - 💰 Producto extra en MercadoPago (único)

4. **Resultado**:
   - ✅ Cliente recibe acceso inmediato
   - ✅ Tú ves el pedido en el panel admin
   - ✅ Base de datos actualizada

## 🔍 **Ver Resultados:**

- **Panel Admin**: http://localhost:3000/admin.html
- **Base de datos**: Archivo `suscripciones.db` (se crea automáticamente)

## ⚡ **Solución a Tu Problema:**

> *"carrito que se pague todo junto como cualquier carrito, pero diferenciando un plan recurrente de algo único"*

**Respuesta**: El sistema maneja ambos tipos pero **MercadoPago requiere procesarlos por separado** porque:

- **Suscripciones**: Requieren un flujo especial para pagos recurrentes
- **Productos únicos**: Usan el flujo normal de pago único

**Solución implementada**:
1. ✅ **Carrito unificado** - Cliente ve todo junto
2. ✅ **Procesamiento inteligente** - Se abren 2 ventanas si es necesario
3. ✅ **Experiencia fluida** - Cliente entiende que son 2 tipos de pago
4. ✅ **Registro completo** - Todo se guarda como un solo pedido

¡Esta es la mejor manera de manejar suscripciones + productos únicos con MercadoPago! 🎯
