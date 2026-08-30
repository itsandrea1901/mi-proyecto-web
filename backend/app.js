const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { sql, conectarDB } = require('./src/db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ========== CONFIGURACIÓN DE CORREO ==========
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'tucorreo@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'lledxsqxzisgzhsy'
    }
});

transporter.verify(function(error, success) {
    if (error) {
        console.log('⚠️ Error en configuración de correo:', error);
    } else {
        console.log('✅ Servidor de correo listo para enviar mensajes');
    }
});

// ========== MIDDLEWARES ==========
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

conectarDB();

// ========== CONFIGURACIÓN DE MULTER ==========
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'file-' + uniqueSuffix + ext);
    }
});

// Multer para imágenes
const uploadImagen = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const tipos = /jpeg|jpg|png|gif|webp/;
        const ext = tipos.test(path.extname(file.originalname).toLowerCase());
        const mime = tipos.test(file.mimetype);
        if (ext && mime) return cb(null, true);
        cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WEBP)'));
    }
});

// Multer para documentos
const uploadDocumento = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const tipos = /pdf|jpg|jpeg|png|doc|docx/;
        const ext = tipos.test(path.extname(file.originalname).toLowerCase());
        if (ext) return cb(null, true);
        cb(new Error('Solo se permiten PDF, JPG, PNG, DOC, DOCX'));
    }
});

// Multer para adjuntos de correo
const uploadAdjuntos = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const tipos = /pdf|jpg|jpeg|png|gif|webp/;
        const ext = tipos.test(path.extname(file.originalname).toLowerCase());
        if (ext) return cb(null, true);
        cb(new Error('Solo se permiten PDF, JPG, PNG, GIF, WEBP'));
    }
});

// ========== FUNCIÓN PARA ENVIAR CORREO ==========
async function enviarCorreoRecuperacion(email, codigo) {
    try {
        const mailOptions = {
            from: `"SIGICOVE - Joyas Valentina" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '🔑 Código de Recuperación de Contraseña',
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #1a1a2e; padding: 30px; text-align: center; border-radius: 15px 15px 0 0;">
                    <h1 style="color: #D4AF37; margin: 0; font-size: 28px;">Joyas Valentina</h1>
                </div>
                <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 15px 15px;">
                    <h2 style="color: #333; margin: 0 0 20px;">Recuperación de Contraseña</h2>
                    <p style="color: #666; font-size: 16px;">Tu código de recuperación es:</p>
                    <div style="background: #D4AF37; padding: 25px; text-align: center; border-radius: 12px; margin: 30px 0;">
                        <span style="font-size: 36px; font-weight: bold; color: white; letter-spacing: 8px;">${codigo}</span>
                    </div>
                    <p style="color: #999; font-size: 14px;">Este código expirará en 10 minutos.</p>
                </div>
            </div>`
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Correo enviado:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Error al enviar correo:', error);
        return false;
    }
}

// ========== LOGIN ==========
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('🔑 Intento de login:', email);
        
        const result = await sql.query`
            SELECT u.id_usuario, u.username, u.email, u.foto, u.id_rol, u.id_empleado,
                   r.nombre as rol, e.primer_nombre, e.segundo_nombre, e.primer_apellido, e.segundo_apellido,
                   e.dpi, s.id_sucursal, s.nombre as sucursal
            FROM usuario u
            INNER JOIN rol r ON u.id_rol = r.id_rol
            INNER JOIN empleado e ON u.id_empleado = e.id_empleado
            INNER JOIN sucursal s ON e.id_sucursal = s.id_sucursal
            WHERE u.email = ${email} AND u.password_hash = ${password} AND u.activo = 1
        `;
        
        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            const nombres = [user.primer_nombre, user.segundo_nombre].filter(Boolean).join(' ');
            const apellidos = [user.primer_apellido, user.segundo_apellido].filter(Boolean).join(' ');
            const nombreCompleto = [nombres, apellidos].filter(Boolean).join(' ');
            
            await sql.query`UPDATE usuario SET ultimo_acceso = GETDATE() WHERE id_usuario = ${user.id_usuario}`;
            
            res.json({ success: true, user: {
                id: user.id_usuario, id_empleado: user.id_empleado, username: user.username,
                email: user.email, foto: user.foto ? `/uploads/${user.foto}` : null,
                rol: user.rol, id_rol: user.id_rol,
                primer_nombre: user.primer_nombre, segundo_nombre: user.segundo_nombre,
                primer_apellido: user.primer_apellido, segundo_apellido: user.segundo_apellido,
                nombres, apellidos, nombreCompleto, dpi: user.dpi,
                id_sucursal: user.id_sucursal, sucursal: user.sucursal
            }});
        } else {
            res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== RECUPERACIÓN DE CONTRASEÑA ==========
function generarCodigoRecuperacion() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post('/api/recuperar-password', async (req, res) => {
    try {
        const { email } = req.body;
        const userResult = await sql.query`SELECT id_usuario, email FROM usuario WHERE email = ${email} AND activo = 1`;
        if (userResult.recordset.length === 0) {
            return res.json({ success: true, message: 'Si el correo existe, recibirás un código' });
        }
        const user = userResult.recordset[0];
        const codigo = generarCodigoRecuperacion();
        const fechaExpiracion = new Date();
        fechaExpiracion.setMinutes(fechaExpiracion.getMinutes() + 10);
        await sql.query`UPDATE recuperacion_password SET usado = 1 WHERE id_usuario = ${user.id_usuario} AND usado = 0`;
        await sql.query`INSERT INTO recuperacion_password (id_usuario, token, fecha_expiracion) VALUES (${user.id_usuario}, ${codigo}, ${fechaExpiracion})`;
        const enviado = await enviarCorreoRecuperacion(email, codigo);
        if (enviado) {
            res.json({ success: true, message: 'Si el correo existe, recibirás un código' });
        } else {
            res.status(500).json({ success: false, message: 'Error al enviar el correo' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al procesar la solicitud' });
    }
});

app.post('/api/verificar-codigo', async (req, res) => {
    try {
        const { email, codigo } = req.body;
        const result = await sql.query`
            SELECT rp.id_recuperacion, rp.id_usuario, rp.token, rp.fecha_expiracion
            FROM recuperacion_password rp
            INNER JOIN usuario u ON rp.id_usuario = u.id_usuario
            WHERE u.email = ${email} AND rp.usado = 0 AND rp.fecha_expiracion > GETDATE()
            ORDER BY rp.fecha_creacion DESC
        `;
        if (result.recordset.length === 0) {
            return res.status(400).json({ success: false, message: 'Código inválido o expirado' });
        }
        if (result.recordset[0].token !== codigo) {
            return res.status(400).json({ success: false, message: 'Código incorrecto' });
        }
        res.json({ success: true, message: 'Código verificado' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/cambiar-password', async (req, res) => {
    try {
        const { email, codigo, nueva_password } = req.body;
        if (!nueva_password || nueva_password.length < 6) {
            return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
        }
        const result = await sql.query`
            SELECT rp.id_recuperacion, rp.id_usuario, rp.token
            FROM recuperacion_password rp
            INNER JOIN usuario u ON rp.id_usuario = u.id_usuario
            WHERE u.email = ${email} AND rp.usado = 0 AND rp.fecha_expiracion > GETDATE()
            ORDER BY rp.fecha_creacion DESC
        `;
        if (result.recordset.length === 0) {
            return res.status(400).json({ success: false, message: 'Código inválido o expirado' });
        }
        if (result.recordset[0].token !== codigo) {
            return res.status(400).json({ success: false, message: 'Código incorrecto' });
        }
        await sql.query`UPDATE usuario SET password_hash = ${nueva_password} WHERE id_usuario = ${result.recordset[0].id_usuario}`;
        await sql.query`UPDATE recuperacion_password SET usado = 1 WHERE id_recuperacion = ${result.recordset[0].id_recuperacion}`;
        res.json({ success: true, message: 'Contraseña actualizada correctamente' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== PERFIL COMPLETO ==========
app.get('/api/perfil-completo/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('👤 Cargando perfil ID:', id);
        
        const result = await sql.query`
            SELECT e.id_empleado, e.primer_nombre, e.segundo_nombre, e.primer_apellido, e.segundo_apellido,
                   e.dpi, e.fecha_nacimiento, e.fecha_contratacion, e.activo,
                   e.id_genero, e.id_nacionalidad, e.id_estado_civil, e.id_tipo_sangre,
                   e.id_profesion, e.id_cargo, e.id_tipo_contrato, e.id_sucursal,
                   s.nombre as sucursal, s.direccion_detallada as direccion_sucursal,
                   s.telefono as telefono_sucursal, s.correo as correo_sucursal,
                   g.nombre as genero, n.nombre as nacionalidad, ec.nombre as estado_civil,
                   ts.nombre as tipo_sangre, ce.nombre as cargo, ce.descripcion as descripcion_cargo,
                   tc.nombre as tipo_contrato, p.nombre as profesion,
                   u.id_usuario, u.username, u.email as correo_usuario, u.foto as foto_usuario,
                   u.ultimo_acceso, u.fecha_creacion as fecha_creacion_usuario, u.activo as usuario_activo,
                   r.nombre as rol, r.id_rol
            FROM empleado e
            LEFT JOIN sucursal s ON e.id_sucursal = s.id_sucursal
            LEFT JOIN genero g ON e.id_genero = g.id_genero
            LEFT JOIN nacionalidad n ON e.id_nacionalidad = n.id_nacionalidad
            LEFT JOIN estado_civil ec ON e.id_estado_civil = ec.id_estado_civil
            LEFT JOIN tipo_sangre ts ON e.id_tipo_sangre = ts.id_tipo_sangre
            LEFT JOIN cargo_empleado ce ON e.id_cargo = ce.id_cargo
            LEFT JOIN tipo_contrato tc ON e.id_tipo_contrato = tc.id_tipo_contrato
            LEFT JOIN profesion p ON e.id_profesion = p.id_profesion
            LEFT JOIN usuario u ON e.id_empleado = u.id_empleado
            LEFT JOIN rol r ON u.id_rol = r.id_rol
            WHERE e.id_empleado = ${id}
        `;
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Empleado no encontrado' });
        }
        
        const empleado = result.recordset[0];
        empleado.telefonos = [];
        empleado.correos_extra = [];
        empleado.direcciones = [];
        empleado.alergias = [];
        empleado.estudios = [];
        empleado.documentos = [];
        
        try { const tels = await sql.query`SELECT telefono FROM empleado_telefono WHERE id_empleado = ${id}`; empleado.telefonos = tels.recordset.map(t => t.telefono); } catch(e) {}
        try { const correos = await sql.query`SELECT correo FROM empleado_correo WHERE id_empleado = ${id}`; empleado.correos_extra = correos.recordset.map(c => c.correo); } catch(e) {}
        try { const dirs = await sql.query`SELECT ed.*, d.nombre as departamento, m.nombre as municipio FROM empleado_direccion ed LEFT JOIN departamento d ON ed.id_departamento = d.id_departamento LEFT JOIN municipio m ON ed.id_municipio = m.id_municipio WHERE ed.id_empleado = ${id}`; empleado.direcciones = dirs.recordset; } catch(e) {}
        try { const alergias = await sql.query`SELECT ea.id_alergia, a.nombre as alergia, ea.observacion FROM empleado_alergia ea INNER JOIN alergia a ON ea.id_alergia = a.id_alergia WHERE ea.id_empleado = ${id}`; empleado.alergias = alergias.recordset; } catch(e) {}
        try { const estudios = await sql.query`SELECT ee.id_estudio, ee.id_nivel_academico, ee.institucion, ee.titulo_obtenido, ee.fecha_finalizacion, na.nombre as nivel_academico FROM empleado_estudio ee LEFT JOIN nivel_academico na ON ee.id_nivel_academico = na.id_nivel_academico WHERE ee.id_empleado = ${id} ORDER BY ee.fecha_finalizacion DESC`; empleado.estudios = estudios.recordset; } catch(e) {}
        try { const docs = await sql.query`SELECT ed.id_documento, ed.nombre_archivo, ed.ruta_archivo, ed.fecha_carga, ed.observacion, td.nombre as tipo_documento FROM empleado_documento ed LEFT JOIN tipo_documento_empleado td ON ed.id_tipo_documento = td.id_tipo_documento WHERE ed.id_empleado = ${id} AND ed.activo = 1 ORDER BY ed.fecha_carga DESC`; empleado.documentos = docs.recordset; } catch(e) {}
        
        res.json({ success: true, empleado });
    } catch (error) {
        console.error('💥 Error perfil:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== USUARIOS ==========
app.get('/api/usuarios', async (req, res) => {
    try {
        const result = await sql.query`
            SELECT u.id_usuario, u.username, u.email, u.foto, u.activo, u.ultimo_acceso, u.fecha_creacion,
                   r.nombre as rol, r.id_rol, e.id_empleado, e.primer_nombre as nombres, e.primer_apellido as apellidos,
                   e.dpi, s.id_sucursal, s.nombre as sucursal
            FROM usuario u
            INNER JOIN rol r ON u.id_rol = r.id_rol
            INNER JOIN empleado e ON u.id_empleado = e.id_empleado
            INNER JOIN sucursal s ON e.id_sucursal = s.id_sucursal
            ORDER BY u.fecha_creacion DESC
        `;
        const usuarios = result.recordset.map(u => ({ ...u, foto: u.foto ? `/uploads/${u.foto}` : null }));
        res.json(usuarios);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/usuarios', async (req, res) => {
    console.log('📥 ========== POST /api/usuarios ==========');
    
    try {
        const { 
            username, email, password, id_rol, 
            primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, 
            dpi, fecha_nacimiento, id_genero, id_nacionalidad, id_estado_civil, id_tipo_sangre, 
            id_profesion, id_cargo, id_tipo_contrato, id_sucursal, fecha_contratacion, 
            id_empleado_existente, telefonos, correos, estudios, alergias, direcciones 
        } = req.body;
        
        console.log('📞 telefonos:', Array.isArray(telefonos) ? telefonos : 'NO ES ARRAY');
        console.log('📧 correos:', Array.isArray(correos) ? correos : 'NO ES ARRAY');
        console.log('🎓 estudios:', Array.isArray(estudios) ? estudios : 'NO ES ARRAY');
        console.log('⚠️ alergias:', Array.isArray(alergias) ? alergias : 'NO ES ARRAY');
        console.log('📍 direcciones:', Array.isArray(direcciones) ? direcciones : 'NO ES ARRAY');
        
        let id_empleado;
        
        if (id_empleado_existente) {
            id_empleado = parseInt(id_empleado_existente);
            console.log('✅ Usando empleado existente ID:', id_empleado);
        } else {
            const emp = await sql.query`
                INSERT INTO empleado (
                    primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, 
                    dpi, fecha_nacimiento, id_genero, id_nacionalidad, id_estado_civil, 
                    id_tipo_sangre, id_profesion, id_cargo, id_tipo_contrato, 
                    id_sucursal, fecha_contratacion
                )
                OUTPUT INSERTED.id_empleado 
                VALUES (
                    ${primer_nombre}, ${segundo_nombre || null}, ${primer_apellido}, ${segundo_apellido || null}, 
                    ${dpi}, ${fecha_nacimiento || null}, ${id_genero || null}, ${id_nacionalidad || null}, 
                    ${id_estado_civil || null}, ${id_tipo_sangre || null}, ${id_profesion || null}, 
                    ${id_cargo || null}, ${id_tipo_contrato || null}, ${id_sucursal}, 
                    ${fecha_contratacion || new Date()}
                )
            `;
            id_empleado = emp.recordset[0].id_empleado;
            console.log('✅ Empleado creado con ID:', id_empleado);
            
            if (Array.isArray(telefonos) && telefonos.length > 0) {
                for (const tel of telefonos) {
                    const telefonoLimpio = String(tel).trim();
                    if (telefonoLimpio) {
                        try {
                            await sql.query`INSERT INTO empleado_telefono (id_empleado, telefono) VALUES (${id_empleado}, ${telefonoLimpio})`;
                            console.log('📞 Teléfono insertado:', telefonoLimpio);
                        } catch(e) { console.error('❌ Teléfono error:', e.message); }
                    }
                }
            }
            
            if (Array.isArray(correos) && correos.length > 0) {
                for (const corr of correos) {
                    const correoLimpio = String(corr).trim();
                    if (correoLimpio) {
                        try {
                            await sql.query`INSERT INTO empleado_correo (id_empleado, correo) VALUES (${id_empleado}, ${correoLimpio})`;
                            console.log('📧 Correo insertado:', correoLimpio);
                        } catch(e) { console.error('❌ Correo error:', e.message); }
                    }
                }
            }
            
            if (Array.isArray(estudios) && estudios.length > 0) {
                for (const est of estudios) {
                    const idNivel = parseInt(est.id_nivel_academico);
                    const institucion = String(est.institucion || '').trim();
                    const titulo = String(est.titulo_obtenido || '').trim();
                    
                    if (idNivel && institucion && titulo) {
                        try {
                            await sql.query`INSERT INTO empleado_estudio (id_empleado, id_nivel_academico, institucion, titulo_obtenido, fecha_finalizacion) VALUES (${id_empleado}, ${idNivel}, ${institucion}, ${titulo}, ${est.fecha_finalizacion || null})`;
                            console.log('🎓 Estudio insertado:', institucion);
                        } catch(e) { console.error('❌ Estudio error:', e.message); }
                    }
                }
            }
            
            if (Array.isArray(alergias) && alergias.length > 0) {
                for (const aler of alergias) {
                    const idAlergia = parseInt(aler.id_alergia);
                    const observacion = aler.observacion ? String(aler.observacion).trim() : null;
                    
                    if (idAlergia && idAlergia > 0) {
                        try {
                            await sql.query`INSERT INTO empleado_alergia (id_empleado, id_alergia, observacion) VALUES (${id_empleado}, ${idAlergia}, ${observacion})`;
                            console.log('⚠️ Alergia insertada:', idAlergia);
                        } catch(e) { console.error('❌ Alergia error:', e.message); }
                    }
                }
            }
            
            if (Array.isArray(direcciones) && direcciones.length > 0) {
                for (const dir of direcciones) {
                    const calle = String(dir.calle || '').trim();
                    const idDepto = parseInt(dir.id_departamento);
                    const idMuni = parseInt(dir.id_municipio);
                    
                    if (calle && idDepto && idMuni) {
                        try {
                            await sql.query`INSERT INTO empleado_direccion (id_empleado, calle, avenida, zona, numero_casa, colonia, id_departamento, id_municipio, referencia) VALUES (${id_empleado}, ${calle}, ${dir.avenida || null}, ${dir.zona || null}, ${dir.numero_casa || null}, ${dir.colonia || null}, ${idDepto}, ${idMuni}, ${dir.referencia || null})`;
                            console.log('📍 Dirección insertada:', calle);
                        } catch(e) { console.error('❌ Dirección error:', e.message); }
                    }
                }
            }
        }
        
        await sql.query`INSERT INTO usuario (username, email, password_hash, id_rol, id_empleado) VALUES (${username}, ${email}, ${password}, ${parseInt(id_rol)}, ${id_empleado})`;
        console.log('✅ Usuario creado exitosamente');
        
        res.json({ success: true, message: 'Usuario creado', id_empleado });
        
    } catch (error) { 
        console.error('💥 ERROR GENERAL:', error);
        res.status(500).json({ success: false, message: error.message }); 
    }
});

app.put('/api/usuarios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, password, id_rol, activo } = req.body;
        if (password) {
            await sql.query`UPDATE usuario SET username=${username}, email=${email}, password_hash=${password}, id_rol=${id_rol}, activo=${activo} WHERE id_usuario=${id}`;
        } else {
            await sql.query`UPDATE usuario SET username=${username}, email=${email}, id_rol=${id_rol}, activo=${activo} WHERE id_usuario=${id}`;
        }
        res.json({ success: true, message: 'Usuario actualizado' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.delete('/api/usuarios/:id', async (req, res) => {
    try {
        await sql.query`UPDATE usuario SET activo = 0 WHERE id_usuario = ${req.params.id}`;
        res.json({ success: true, message: 'Usuario desactivado' });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// ========== FOTO DE PERFIL ==========
app.post('/api/usuarios/:id/foto', uploadImagen.single('foto'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) return res.status(400).json({ success: false, message: 'No se envió imagen' });
        const u = await sql.query`SELECT foto FROM usuario WHERE id_usuario = ${id}`;
        const anterior = u.recordset[0]?.foto;
        if (anterior) {
            const ruta = path.join(__dirname, 'public', 'uploads', anterior);
            if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
        }
        await sql.query`UPDATE usuario SET foto = ${req.file.filename} WHERE id_usuario = ${id}`;
        res.json({ success: true, foto: `/uploads/${req.file.filename}` });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ========== CATÁLOGOS ==========
app.get('/api/roles', async (req, res) => { const r = await sql.query`SELECT * FROM rol WHERE activo = 1 ORDER BY nombre`; res.json(r.recordset); });
app.get('/api/sucursales', async (req, res) => { const r = await sql.query`SELECT * FROM sucursal WHERE activo = 1 ORDER BY nombre`; res.json(r.recordset); });
app.get('/api/generos', async (req, res) => { const r = await sql.query`SELECT id_genero, nombre FROM genero WHERE activo = 1 ORDER BY nombre`; res.json(r.recordset); });
app.get('/api/nacionalidades', async (req, res) => { const r = await sql.query`SELECT id_nacionalidad, nombre FROM nacionalidad WHERE activo = 1 ORDER BY nombre`; res.json(r.recordset); });
app.get('/api/estados-civiles', async (req, res) => { const r = await sql.query`SELECT id_estado_civil, nombre FROM estado_civil WHERE activo = 1 ORDER BY nombre`; res.json(r.recordset); });
app.get('/api/tipos-sangre', async (req, res) => { const r = await sql.query`SELECT id_tipo_sangre, nombre FROM tipo_sangre WHERE activo = 1 ORDER BY nombre`; res.json(r.recordset); });
app.get('/api/profesiones', async (req, res) => { const r = await sql.query`SELECT id_profesion, nombre FROM profesion WHERE activo = 1 ORDER BY nombre`; res.json(r.recordset); });
app.get('/api/cargos', async (req, res) => { const r = await sql.query`SELECT id_cargo, nombre FROM cargo_empleado WHERE activo = 1 ORDER BY nombre`; res.json(r.recordset); });
app.get('/api/tipos-contrato', async (req, res) => { const r = await sql.query`SELECT id_tipo_contrato, nombre FROM tipo_contrato WHERE activo = 1 ORDER BY nombre`; res.json(r.recordset); });
app.get('/api/departamentos', async (req, res) => { const r = await sql.query`SELECT id_departamento, nombre FROM departamento WHERE activo = 1 ORDER BY nombre`; res.json(r.recordset); });
app.get('/api/municipios/:idDepartamento', async (req, res) => { const r = await sql.query`SELECT id_municipio, nombre FROM municipio WHERE id_departamento = ${req.params.idDepartamento} AND activo = 1 ORDER BY nombre`; res.json(r.recordset); });
app.get('/api/niveles-academicos', async (req, res) => { const r = await sql.query`SELECT id_nivel_academico, nombre FROM nivel_academico WHERE activo = 1 ORDER BY nombre`; res.json(r.recordset); });
app.get('/api/alergias', async (req, res) => { const r = await sql.query`SELECT id_alergia, nombre FROM alergia WHERE activo = 1 ORDER BY nombre`; res.json(r.recordset); });
app.get('/api/tipos-documento', async (req, res) => { const r = await sql.query`SELECT id_tipo_documento, nombre FROM tipo_documento_empleado WHERE activo = 1 ORDER BY nombre`; res.json(r.recordset); });
app.get('/api/empleados-sin-usuario', async (req, res) => {
    try {
        const r = await sql.query`
            SELECT e.id_empleado, 
                   e.primer_nombre + ' ' + ISNULL(e.segundo_nombre + ' ', '') + e.primer_apellido + ' ' + ISNULL(e.segundo_apellido, '') as nombre_completo,
                   e.primer_nombre as nombres, e.primer_apellido as apellidos, e.dpi, e.id_sucursal
            FROM empleado e
            LEFT JOIN usuario u ON e.id_empleado = u.id_empleado
            WHERE u.id_usuario IS NULL AND e.activo = 1
            ORDER BY e.primer_nombre
        `;
        res.json(r.recordset);
    } catch (error) { res.status(500).json([]); }
});

// ========== DOCUMENTOS ==========
app.post('/api/empleados/:id/documentos', uploadDocumento.single('documento'), async (req, res) => {
    try {
        const { id } = req.params;
        const id_tipo_documento = parseInt(req.body.id_tipo_documento);
        const observacion = req.body.observacion || null;
        if (!req.file) return res.status(400).json({ success: false, message: 'No se envió archivo' });
        if (!id_tipo_documento) return res.status(400).json({ success: false, message: 'Seleccione un tipo de documento' });
        const result = await sql.query`
            INSERT INTO empleado_documento (id_empleado, id_tipo_documento, nombre_archivo, ruta_archivo, observacion)
            OUTPUT INSERTED.id_documento
            VALUES (${parseInt(id)}, ${id_tipo_documento}, ${req.file.originalname}, ${'/uploads/' + req.file.filename}, ${observacion})
        `;
        res.json({ success: true, message: 'Documento subido', id_documento: result.recordset[0].id_documento });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.get('/api/empleados/:id/documentos', async (req, res) => {
    try {
        const r = await sql.query`
            SELECT ed.id_documento, ed.nombre_archivo, ed.ruta_archivo, ed.fecha_carga, ed.observacion, td.nombre as tipo_documento
            FROM empleado_documento ed
            INNER JOIN tipo_documento_empleado td ON ed.id_tipo_documento = td.id_tipo_documento
            WHERE ed.id_empleado = ${req.params.id} AND ed.activo = 1
            ORDER BY ed.fecha_carga DESC
        `;
        res.json(r.recordset);
    } catch (error) { res.status(500).json([]); }
});

app.delete('/api/documentos/:id', async (req, res) => {
    try {
        await sql.query`UPDATE empleado_documento SET activo = 0 WHERE id_documento = ${req.params.id}`;
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ========== CLIENTES ==========
app.get('/api/clientes', async (req, res) => {
    try {
        const r = await sql.query`SELECT c.id_cliente, c.primer_nombre, c.segundo_nombre, c.primer_apellido, c.segundo_apellido, c.dpi, c.nit, c.fecha_registro, c.activo FROM cliente c ORDER BY c.primer_apellido, c.primer_nombre`;
        res.json(r.recordset);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/clientes', async (req, res) => {
    try {
        const { primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dpi, nit } = req.body;
        if (!primer_nombre || !primer_apellido) return res.status(400).json({ success: false, message: 'Nombre y apellido son requeridos' });
        const result = await sql.query`INSERT INTO cliente (primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dpi, nit) OUTPUT INSERTED.id_cliente VALUES (${primer_nombre}, ${segundo_nombre || null}, ${primer_apellido}, ${segundo_apellido || null}, ${dpi || null}, ${nit || null})`;
        res.json({ success: true, id_cliente: result.recordset[0].id_cliente, message: 'Cliente creado' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.put('/api/clientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, dpi, nit, activo } = req.body;
        await sql.query`UPDATE cliente SET primer_nombre=${primer_nombre}, segundo_nombre=${segundo_nombre || null}, primer_apellido=${primer_apellido}, segundo_apellido=${segundo_apellido || null}, dpi=${dpi || null}, nit=${nit || null}, activo=${activo !== undefined ? activo : 1} WHERE id_cliente=${id}`;
        res.json({ success: true, message: 'Cliente actualizado' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.delete('/api/clientes/:id', async (req, res) => {
    try {
        await sql.query`UPDATE cliente SET activo = 0 WHERE id_cliente = ${req.params.id}`;
        res.json({ success: true, message: 'Cliente desactivado' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.post('/api/clientes/venta', async (req, res) => {
    const { primer_nombre, primer_apellido, nit, dpi } = req.body;
    if (!primer_nombre || !primer_apellido || !nit) return res.status(400).json({ success: false, message: 'Faltan campos' });
    try {
        const check = await sql.query`SELECT id_cliente FROM cliente WHERE nit = ${nit}`;
        if (check.recordset.length > 0) return res.json({ success: true, id_cliente: check.recordset[0].id_cliente, message: 'Cliente existente' });
        const result = await sql.query`INSERT INTO cliente (primer_nombre, primer_apellido, nit, dpi) OUTPUT INSERTED.id_cliente VALUES (${primer_nombre}, ${primer_apellido}, ${nit}, ${dpi || null})`;
        res.json({ success: true, id_cliente: result.recordset[0].id_cliente, message: 'Cliente creado' });
    } catch (error) {
        try { const check2 = await sql.query`SELECT id_cliente FROM cliente WHERE nit = ${nit}`; if (check2.recordset.length > 0) return res.json({ success: true, id_cliente: check2.recordset[0].id_cliente }); } catch(e2) {}
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== INVENTARIOS ==========
app.get('/api/inventario-plata', async (req, res) => {
    try { const r = await sql.query`SELECT ip.id_plata as id, ip.codigo_unico as codigo, ip.descripcion as nombre, ip.peso, ip.precio_costo, ip.precio_publico as precio, ep.nombre as estado, cp.nombre as categoria FROM inventario_plata ip INNER JOIN estado_producto ep ON ip.id_estado_producto = ep.id_estado_producto INNER JOIN categoria_producto cp ON ip.id_categoria_producto = cp.id_categoria_producto WHERE ip.activo = 1 ORDER BY ip.fecha_registro DESC`; res.json(r.recordset); } catch (error) { res.status(500).json({ message: error.message }); }
});
app.get('/api/inventario-oro', async (req, res) => {
    try { const r = await sql.query`SELECT io.id_oro as id, io.codigo_unico as codigo, io.descripcion as nombre, io.peso, io.precio_costo, io.precio_publico as precio, ep.nombre as estado, cp.nombre as categoria FROM inventario_oro io INNER JOIN estado_producto ep ON io.id_estado_producto = ep.id_estado_producto INNER JOIN categoria_producto cp ON io.id_categoria_producto = cp.id_categoria_producto WHERE io.activo = 1 ORDER BY io.fecha_registro DESC`; res.json(r.recordset); } catch (error) { res.status(500).json({ message: error.message }); }
});
app.get('/api/inventario-acero', async (req, res) => {
    try { const r = await sql.query`SELECT ia.id_acero as id, ia.codigo_unico as codigo, ia.descripcion as nombre, ia.precio_costo, ia.precio_publico as precio, ep.nombre as estado, cp.nombre as categoria FROM inventario_acero ia INNER JOIN estado_producto ep ON ia.id_estado_producto = ep.id_estado_producto INNER JOIN categoria_producto cp ON ia.id_categoria_producto = cp.id_categoria_producto WHERE ia.activo = 1 ORDER BY ia.fecha_registro DESC`; res.json(r.recordset); } catch (error) { res.status(500).json({ message: error.message }); }
});
app.get('/api/inventario-empaques', async (req, res) => {
    try { const r = await sql.query`SELECT ie.id_empaque as id, ie.codigo_unico as codigo, ie.descripcion as nombre, ie.precio_costo, ie.precio_publico as precio, ep.nombre as estado FROM inventario_empaque ie INNER JOIN estado_producto ep ON ie.id_estado_producto = ep.id_estado_producto WHERE ie.activo = 1 ORDER BY ie.fecha_registro DESC`; res.json(r.recordset); } catch (error) { res.status(500).json({ message: error.message }); }
});
app.get('/api/inventario-insumos', async (req, res) => {
    try { const r = await sql.query`SELECT ii.id_insumo as id, ii.codigo, ii.descripcion as nombre, ti.nombre as tipo, ii.cantidad, ii.precio_costo, ii.precio_publico as precio FROM inventario_insumo ii INNER JOIN tipo_insumo ti ON ii.id_tipo_insumo = ti.id_tipo_insumo WHERE ii.activo = 1 ORDER BY ii.fecha_registro DESC`; res.json(r.recordset); } catch (error) { res.status(500).json({ message: error.message }); }
});

// ========== INGRESO DE PRODUCTO ==========
async function verificarCodigoUnico(codigo, tipo) {
    try {
        let result;
        switch (tipo) {
            case 'plata': result = await sql.query`SELECT codigo_unico FROM inventario_plata WHERE codigo_unico = ${codigo} AND activo = 1`; break;
            case 'oro': result = await sql.query`SELECT codigo_unico FROM inventario_oro WHERE codigo_unico = ${codigo} AND activo = 1`; break;
            case 'acero': result = await sql.query`SELECT codigo_unico FROM inventario_acero WHERE codigo_unico = ${codigo} AND activo = 1`; break;
            case 'empaque': result = await sql.query`SELECT codigo_unico FROM inventario_empaque WHERE codigo_unico = ${codigo} AND activo = 1`; break;
            case 'insumo': result = await sql.query`SELECT codigo FROM inventario_insumo WHERE codigo = ${codigo} AND activo = 1`; break;
            default: return false;
        }
        return result.recordset.length > 0;
    } catch (e) { return false; }
}

async function obtenerEstadoIngreso() {
    try {
        const result = await sql.query`SELECT TOP 1 id_estado_ingreso FROM estado_ingreso ORDER BY id_estado_ingreso`;
        if (result.recordset.length > 0) return result.recordset[0].id_estado_ingreso;
        const insert = await sql.query`INSERT INTO estado_ingreso (nombre) OUTPUT INSERTED.id_estado_ingreso VALUES ('Completado')`;
        return insert.recordset[0].id_estado_ingreso;
    } catch (e) { return 1; }
}

async function obtenerEstadoDisponible() {
    try {
        const result = await sql.query`SELECT TOP 1 id_estado_producto FROM estado_producto WHERE nombre = 'Disponible'`;
        if (result.recordset.length > 0) return result.recordset[0].id_estado_producto;
        const first = await sql.query`SELECT TOP 1 id_estado_producto FROM estado_producto ORDER BY id_estado_producto`;
        if (first.recordset.length > 0) return first.recordset[0].id_estado_producto;
        const insert = await sql.query`INSERT INTO estado_producto (nombre, descripcion) OUTPUT INSERTED.id_estado_producto VALUES ('Disponible', 'Producto disponible')`;
        return insert.recordset[0].id_estado_producto;
    } catch (e) { return 1; }
}

app.post('/api/ingreso-producto', async (req, res) => {
    try {
        const { tipo, codigo, descripcion, precio_costo, precio_publico, peso, id_categoria, id_tipo_insumo, cantidad, id_usuario } = req.body;
        if (tipo !== 'servicio') {
            const existe = await verificarCodigoUnico(codigo, tipo);
            if (existe) return res.status(400).json({ success: false, message: 'Este código ya existe' });
        }
        const idEstadoIngreso = await obtenerEstadoIngreso();
        const idEstadoProducto = await obtenerEstadoDisponible();
        const numeroIngreso = 'ING-' + Date.now();
        const ingResult = await sql.query`INSERT INTO ingreso (numero_ingreso, id_sucursal, id_usuario, id_estado_ingreso, observacion) OUTPUT INSERTED.id_ingreso VALUES (${numeroIngreso}, 1, ${id_usuario || 1}, ${idEstadoIngreso}, ${'Ingreso: ' + tipo})`;
        const id_ingreso = ingResult.recordset[0].id_ingreso;
        switch (tipo) {
            case 'plata': await sql.query`INSERT INTO inventario_plata (codigo_unico, descripcion, peso, precio_costo, precio_publico, id_categoria_producto, id_estado_producto, id_ingreso) VALUES (${codigo}, ${descripcion}, ${peso || 0}, ${precio_costo}, ${precio_publico}, ${id_categoria || 1}, ${idEstadoProducto}, ${id_ingreso})`; break;
            case 'oro': await sql.query`INSERT INTO inventario_oro (codigo_unico, descripcion, peso, precio_costo, precio_publico, id_categoria_producto, id_estado_producto, id_ingreso) VALUES (${codigo}, ${descripcion}, ${peso || 0}, ${precio_costo}, ${precio_publico}, ${id_categoria || 1}, ${idEstadoProducto}, ${id_ingreso})`; break;
            case 'acero': await sql.query`INSERT INTO inventario_acero (codigo_unico, descripcion, precio_costo, precio_publico, id_categoria_producto, id_estado_producto, id_ingreso) VALUES (${codigo}, ${descripcion}, ${precio_costo}, ${precio_publico}, ${id_categoria || 1}, ${idEstadoProducto}, ${id_ingreso})`; break;
            case 'empaque': await sql.query`INSERT INTO inventario_empaque (codigo_unico, descripcion, precio_costo, precio_publico, id_estado_producto, id_ingreso) VALUES (${codigo}, ${descripcion}, ${precio_costo}, ${precio_publico}, ${idEstadoProducto}, ${id_ingreso})`; break;
            case 'insumo': await sql.query`INSERT INTO inventario_insumo (codigo, descripcion, id_tipo_insumo, cantidad, precio_costo, precio_publico, id_ingreso) VALUES (${codigo}, ${descripcion}, ${id_tipo_insumo || 1}, ${cantidad || 1}, ${precio_costo}, ${precio_publico}, ${id_ingreso})`; break;
            case 'servicio': await sql.query`INSERT INTO inventario_servicio (descripcion, id_tipo_servicio, precio_costo, precio_publico, id_ingreso) VALUES (${descripcion}, 1, ${precio_costo || 0}, ${precio_publico || 0}, ${id_ingreso})`; break;
        }
        res.json({ success: true, message: 'Producto registrado', id_ingreso, codigo });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ========== SERVICIOS ==========
app.get('/api/servicios', async (req, res) => {
    try { const r = await sql.query`SELECT isv.id_servicio, isv.descripcion, isv.precio_costo, isv.precio_publico, isv.activo FROM inventario_servicio isv ORDER BY isv.descripcion`; res.json(r.recordset); } catch (error) { res.status(500).json({ message: error.message }); }
});

// ========== VENTAS ==========
app.post('/api/ventas', async (req, res) => {
    try {
        const { numero_factura, id_cliente, id_empleado, id_usuario, id_sucursal, id_estado_venta, subtotal, descuento, total } = req.body;
        const result = await sql.query`INSERT INTO venta (numero_factura, id_cliente, id_empleado, id_usuario, id_sucursal, id_estado_venta, subtotal, descuento, total) OUTPUT INSERTED.id_venta VALUES (${numero_factura}, ${id_cliente}, ${id_empleado || 1}, ${id_usuario || 1}, ${id_sucursal || 1}, ${id_estado_venta || 1}, ${subtotal}, ${descuento}, ${total})`;
        res.json({ success: true, id_venta: result.recordset[0].id_venta });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.put('/api/producto/vender/:tipo/:id', async (req, res) => {
    try {
        const { tipo, id } = req.params;
        let idEstadoVendido = 2;
        try { const estado = await sql.query`SELECT id_estado_producto FROM estado_producto WHERE nombre = 'Vendido'`; if (estado.recordset.length > 0) idEstadoVendido = estado.recordset[0].id_estado_producto; } catch(e) {}
        switch(tipo) {
            case 'plata': await sql.query`UPDATE inventario_plata SET id_estado_producto = ${idEstadoVendido} WHERE id_plata = ${id}`; break;
            case 'oro': await sql.query`UPDATE inventario_oro SET id_estado_producto = ${idEstadoVendido} WHERE id_oro = ${id}`; break;
            case 'acero': await sql.query`UPDATE inventario_acero SET id_estado_producto = ${idEstadoVendido} WHERE id_acero = ${id}`; break;
            case 'empaque': await sql.query`UPDATE inventario_empaque SET id_estado_producto = ${idEstadoVendido} WHERE id_empaque = ${id}`; break;
            case 'insumo': await sql.query`UPDATE inventario_insumo SET cantidad = cantidad - 1 WHERE id_insumo = ${id} AND cantidad > 0`; break;
        }
        res.json({ success: true, message: 'Producto actualizado' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.put('/api/insumo/descontar/:id/:cantidad', async (req, res) => {
    try {
        const { id, cantidad } = req.params;
        const cant = parseInt(cantidad) || 1;
        const result = await sql.query`UPDATE inventario_insumo SET cantidad = cantidad - ${cant} WHERE id_insumo = ${id} AND cantidad >= ${cant}`;
        if (result.rowsAffected[0] > 0) res.json({ success: true, message: 'Insumo descontado' });
        else res.status(400).json({ success: false, message: 'Stock insuficiente' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ========== MENSAJES ==========
app.get('/api/mensajes', async (req, res) => { const r = await sql.query`SELECT * FROM contacto ORDER BY fecha_envio DESC`; res.json(r.recordset); });
app.post('/api/contacto', async (req, res) => {
    try {
        const { nombre, email, telefono, mensaje } = req.body;
        await sql.query`INSERT INTO contacto (nombre_completo, correo, telefono, mensaje) VALUES (${nombre}, ${email}, ${telefono || null}, ${mensaje})`;
        res.json({ success: true, message: 'Mensaje enviado' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});
app.put('/api/mensajes/:id/leido', async (req, res) => { await sql.query`UPDATE contacto SET leido = 1 WHERE id_contacto = ${req.params.id}`; res.json({ success: true }); });
app.put('/api/mensajes/:id/noleido', async (req, res) => { await sql.query`UPDATE contacto SET leido = 0 WHERE id_contacto = ${req.params.id}`; res.json({ success: true }); });
app.delete('/api/mensajes/:id', async (req, res) => { await sql.query`DELETE FROM contacto WHERE id_contacto = ${req.params.id}`; res.json({ success: true }); });

// ========== ENVIAR RESPUESTA CON ADJUNTOS ==========
app.post('/api/enviar-respuesta', uploadAdjuntos.array('adjuntos', 5), async (req, res) => {
    try {
        const { correo_destino, asunto, mensaje } = req.body;
        
        if (!correo_destino || !asunto || !mensaje) {
            return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
        }
        
        console.log('📧 Enviando respuesta a:', correo_destino);
        console.log('📎 Adjuntos:', req.files ? req.files.length : 0);
        
        const mailOptions = {
            from: `"Joyas Valentina" <${process.env.EMAIL_USER}>`,
            to: correo_destino,
            subject: asunto,
            text: mensaje,
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #1a1a2e; padding: 30px; text-align: center; border-radius: 15px 15px 0 0;">
                    <h1 style="color: #D4AF37; margin: 0;">Joyas Valentina</h1>
                </div>
                <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 15px 15px; border: 1px solid #eee;">
                    <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.8; color: #333;">${mensaje}</div>
                </div>
                <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
                    <p>CC Plaza San Cristóbal Local Interior de Paiz, Zona 8 Mixco</p>
                    <p>Tel: (502) 3809-0253 | jvalentinamayoreo@gmail.com</p>
                </div>
            </div>`
        };
        
        if (req.files && req.files.length > 0) {
            mailOptions.attachments = req.files.map(file => ({
                filename: file.originalname,
                path: file.path
            }));
        }
        
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Respuesta enviada:', info.messageId);
        
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Error eliminando archivo:', err);
                });
            });
        }
        
        res.json({ success: true, message: 'Respuesta enviada correctamente' });
    } catch (error) {
        console.error('❌ Error enviando respuesta:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, () => {
    console.log('=========================================');
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`🗄️  BD: ${process.env.DB_NAME || 'SIGICOVE'}`);
    console.log('=========================================');
});