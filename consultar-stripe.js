// Script para consultar productos y precios desde Stripe API
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function consultarProductosStripe() {
  console.log('🔍 Consultando productos configurados en Stripe...\n');
  
  const priceIds = [
    { name: 'PAQUETE_1', id: process.env.STRIPE_PRICE_PAQUETE_1 },
    { name: 'PAQUETE_2', id: process.env.STRIPE_PRICE_PAQUETE_2 },
    { name: 'PAGINA_WEB', id: process.env.STRIPE_PRICE_PAGINA_WEB },
    { name: 'LOGOS', id: process.env.STRIPE_PRICE_LOGOS }
  ];
  
  for (const priceInfo of priceIds) {
    try {
      console.log(`📋 Consultando ${priceInfo.name}...`);
      
      // Obtener información del precio
      const price = await stripe.prices.retrieve(priceInfo.id, {
        expand: ['product']
      });
      
      // Obtener información del producto
      const product = price.product;
      
      console.log(`✅ ${priceInfo.name}:`);
      console.log(`   📦 Producto: ${product.name}`);
      console.log(`   💰 Precio: $${(price.unit_amount / 100).toFixed(2)} ${price.currency.toUpperCase()}`);
      console.log(`   🔄 Tipo: ${price.type === 'recurring' ? 'Suscripción (' + price.recurring.interval + ')' : 'Pago único'}`);
      console.log(`   🆔 Price ID: ${price.id}`);
      console.log(`   🎯 Activo: ${price.active ? 'Sí' : 'No'}`);
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error consultando ${priceInfo.name}:`, error.message);
      console.log('');
    }
  }
}

// Ejecutar consulta
consultarProductosStripe().catch(console.error);
