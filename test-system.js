// 🧪 Script de Testing - Sistema de Suscripciones
// Script para probar todas las funcionalidades del sistema
// Ejecutar con: node test-system.js

const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

const BASE_URL = 'http://localhost:3000';

// Configuración de PostgreSQL para testing
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'suscripciones_db',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function testHealthEndpoint() {
  console.log('🔍 Testing health endpoint...');
  try {
    const response = await axios.get(`${BASE_URL}/api/health`);
    console.log('✅ Health check passed:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connection successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

async function testOrderCreation() {
  console.log('🔍 Testing order creation...');
  
  const testOrder = {
    customer: {
      nombre: 'Juan Test',
      apellido: 'Prueba',
      email: 'test@example.com'
    },
    subscription: {
      id: 'sub1',
      name: 'Paquete Premium Test',
      price: 10,
      url: 'https://www.mercadopago.com.mx/subscriptions/checkout?preapproval_plan_id=2c93808497e5a7880197e620da930045',
      type: 'subscription'
    },
    extras: [
      {
        id: 'extra1',
        name: 'Producto Extra Test',
        price: 50,
        url: 'https://mpago.la/33sgGGY',
        type: 'extra'
      }
    ]
  };

  try {
    const response = await axios.post(`${BASE_URL}/api/orders`, testOrder);
    console.log('✅ Order creation successful:', response.data);
    
    // Verificar en base de datos
    const dbCheck = await pool.query(
      'SELECT * FROM pedidos WHERE orden_numero = $1',
      [response.data.orderNumber]
    );
    
    if (dbCheck.rows.length > 0) {
      console.log('✅ Order verified in database');
    } else {
      console.log('❌ Order not found in database');
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Order creation failed:', error.response?.data || error.message);
    return null;
  }
}

async function testDatabaseTables() {
  console.log('🔍 Testing database tables...');
  
  const tables = ['customers', 'subscriptions', 'productos_extra', 'pedidos', 'webhook_logs'];
  
  for (const table of tables) {
    try {
      const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`✅ Table ${table}: ${result.rows[0].count} records`);
    } catch (error) {
      console.error(`❌ Table ${table} not accessible:`, error.message);
    }
  }
}

async function testWebhookEndpoint() {
  console.log('🔍 Testing webhook endpoint...');
  
  const testWebhook = {
    type: 'payment',
    data: {
      id: 'test_payment_123'
    }
  };

  try {
    const response = await axios.post(`${BASE_URL}/api/webhooks/mercadopago`, testWebhook);
    console.log('✅ Webhook endpoint successful:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Webhook endpoint failed:', error.response?.data || error.message);
    return false;
  }
}

async function testEmailConfiguration() {
  console.log('🔍 Testing email configuration...');
  
  const nodemailer = require('nodemailer');
  
  try {
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Verificar configuración
    const verified = await transporter.verify();
    
    if (verified) {
      console.log('✅ Email configuration is valid');
      return true;
    }
  } catch (error) {
    console.error('❌ Email configuration failed:', error.message);
    console.log('💡 Verifica tu EMAIL_USER y EMAIL_PASS en el archivo .env');
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Iniciando tests del sistema...\n');

  const results = {
    health: await testHealthEndpoint(),
    database: await testDatabaseConnection(),
    tables: await testDatabaseTables(),
    email: await testEmailConfiguration(),
    order: await testOrderCreation(),
    webhook: await testWebhookEndpoint()
  };

  console.log('\n📊 Resumen de Tests:');
  console.log('====================');
  
  Object.entries(results).forEach(([test, passed]) => {
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });

  const totalPassed = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 Total: ${totalPassed}/${totalTests} tests passed`);
  
  if (totalPassed === totalTests) {
    console.log('🎉 ¡Todos los tests pasaron! El sistema está listo para usar.');
  } else {
    console.log('⚠️  Algunos tests fallaron. Revisa la configuración.');
    console.log('📖 Consulta INSTALACION.md para más detalles.');
  }

  await pool.end();
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testHealthEndpoint,
  testDatabaseConnection,
  testOrderCreation,
  testWebhookEndpoint,
  testEmailConfiguration
};
