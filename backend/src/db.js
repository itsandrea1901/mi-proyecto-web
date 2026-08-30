const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function conectarDB() {
    try {
        await sql.connect(dbConfig);
        console.log('✅ Conectado a SQL Server');
    } catch (error) {
        console.error('❌ Error de conexión:', error);
    }
}

module.exports = { sql, conectarDB };