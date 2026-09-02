// migrate-passwords.js
const bcrypt = require('bcrypt');
const { sql, conectarDB } = require('./src/db');
const saltRounds = 10;

async function migrarContraseñas() {
    try {
        await conectarDB();
        console.log('Iniciando migración de contraseñas...');
        
        const result = await sql.query`SELECT id_usuario, username, password_hash FROM usuario WHERE activo = 1`;
        
        for (const user of result.recordset) {
            if (!user.password_hash.startsWith('$2')) {
                const hash = await bcrypt.hash(user.password_hash, saltRounds);
                await sql.query`UPDATE usuario SET password_hash = ${hash} WHERE id_usuario = ${user.id_usuario}`;
                console.log('Migrado: ' + user.username);
            } else {
                console.log('Ya hasheado: ' + user.username);
            }
        }
        
        console.log('Migración completada');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

migrarContraseñas();