// ========== JOYAS VALENTINA - SCRIPT PRINCIPAL ==========
(function() {
    'use strict';
    
    const menuToggle = document.querySelector('.menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    const navLinks = document.querySelectorAll('.nav-link');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const homeLink = document.getElementById('home-link');
    const footerHome = document.getElementById('footer-home');
    const heroBtn = document.getElementById('hero-btn');
    const pageContents = document.querySelectorAll('.page-content');
    const contentSection = document.getElementById('content-area');
    const backHomeLinks = document.querySelectorAll('.back-home');
    const yearSpan = document.getElementById('year');
    const togglePassword = document.getElementById('toggle-password');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    
    let currentUser = null;
    let emailRecuperacion = '';
    let timerReenvio = null;
    
    function updateYear() { if (yearSpan) yearSpan.textContent = new Date().getFullYear(); }
    
    function showToast(message, type = 'success') {
        const existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i><span>${message}</span>`;
        toast.style.cssText = `position:fixed;bottom:30px;right:30px;background:${type==='success'?'#10b981':'#ef4444'};color:white;padding:14px 24px;border-radius:12px;display:flex;align-items:center;gap:12px;z-index:9999;animation:slideIn 0.3s ease;box-shadow:0 10px 25px rgba(0,0,0,0.2);font-weight:500;cursor:pointer;`;
        document.body.appendChild(toast);
        toast.addEventListener('click', () => toast.remove());
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3000);
    }
    
    function updateAuthUI() {
        const lb = document.getElementById('login-btn'), lob = document.getElementById('logout-btn'), g = document.getElementById('user-greeting');
        if (currentUser) {
            if (lb) lb.style.display = 'none';
            if (lob) lob.style.display = 'inline-flex';
            if (g) { g.style.display = 'inline'; g.innerHTML = `<i class="fas fa-user-check"></i> Hola, ${currentUser.nombreCompleto || currentUser.nombres || currentUser.username}`; }
        } else {
            if (lb) lb.style.display = 'inline-flex';
            if (lob) lob.style.display = 'none';
            if (g) g.style.display = 'none';
        }
    }
    
    function closeMenu() {
        if (mainNav?.classList.contains('active')) { 
            mainNav.classList.remove('active'); 
            menuToggle?.setAttribute('aria-expanded','false'); 
        }
    }
    
    function showPage(pageId) {
        pageContents.forEach(p => p.classList.remove('active'));
        const target = document.getElementById(pageId);
        if (target) { 
            target.classList.add('active'); 
            if (contentSection) contentSection.style.display = 'none';
            setTimeout(() => {
                const headerHeight = 80;
                const elementPosition = target.getBoundingClientRect().top + window.pageYOffset;
                const offsetPosition = elementPosition - headerHeight;
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }, 100);
        }
        closeMenu();
    }
    
    function goToHome() {
        pageContents.forEach(p => p.classList.remove('active'));
        if (contentSection) {
            contentSection.style.display = 'block';
            setTimeout(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 100);
        }
        closeMenu();
    }
    
    function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
    
    // ========== MODAL DE CARGA DE LOGIN ==========
    function mostrarModalCargando(email) {
        const modal = document.getElementById('modal-cargando');
        if (!modal) return;
        
        // Resetear animaciones
        const nombreUsuarioEl = document.getElementById('cargando-nombre-usuario');
        const textoEl = document.getElementById('cargando-texto');
        const barraEl = document.getElementById('cargando-barra-progreso');
        
        if (nombreUsuarioEl) nombreUsuarioEl.textContent = 'Verificando credenciales...';
        if (textoEl) textoEl.textContent = 'Iniciando sesión...';
        if (barraEl) barraEl.style.width = '0%';
        
        // Mostrar modal
        modal.style.display = 'flex';
        
        // Animar barra de progreso
        setTimeout(() => {
            if (barraEl) barraEl.style.width = '40%';
            if (textoEl) textoEl.textContent = 'Verificando credenciales...';
        }, 300);
        
        setTimeout(() => {
            if (barraEl) barraEl.style.width = '70%';
            if (textoEl) textoEl.textContent = 'Cargando información...';
        }, 800);
        
        setTimeout(() => {
            if (barraEl) barraEl.style.width = '90%';
            if (textoEl) textoEl.textContent = 'Preparando tu panel...';
        }, 1300);
    }
    
    function cerrarModalCargando() {
        const modal = document.getElementById('modal-cargando');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    // ========== TOGGLE PASSWORD ==========
    function initTogglePassword() {
        if (!togglePassword || !document.getElementById('login-password')) return;
        
        togglePassword.addEventListener('click', function() {
            const passwordInput = document.getElementById('login-password');
            const icon = this.querySelector('i');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    }
    
    // ========== RECUPERACIÓN DE CONTRASEÑA ==========
    function abrirModalRecuperacion() {
        const modal = document.getElementById('modal-recuperacion');
        if (modal) {
            modal.style.display = 'flex';
            mostrarPasoRecuperacion(1);
            // Limpiar campos
            document.getElementById('recuperacion-email').value = '';
            document.getElementById('recuperacion-codigo').value = '';
            document.getElementById('recuperacion-nueva-password').value = '';
            document.getElementById('recuperacion-confirmar-password').value = '';
            // Resetear botón de reenvío
            const btnReenvio = document.getElementById('btn-reenviar-codigo');
            if (btnReenvio) {
                btnReenvio.disabled = false;
                btnReenvio.innerHTML = '<i class="fas fa-redo"></i> Reenviar código';
            }
            if (timerReenvio) {
                clearInterval(timerReenvio);
                timerReenvio = null;
            }
        }
    }
    
    function cerrarModalRecuperacion() {
        const modal = document.getElementById('modal-recuperacion');
        if (modal) {
            modal.style.display = 'none';
        }
        if (timerReenvio) {
            clearInterval(timerReenvio);
            timerReenvio = null;
        }
    }
    
    function mostrarPasoRecuperacion(paso) {
        const paso1 = document.getElementById('paso-1-recuperacion');
        const paso2 = document.getElementById('paso-2-recuperacion');
        const paso3 = document.getElementById('paso-3-recuperacion');
        
        if (paso1) paso1.style.display = paso === 1 ? 'block' : 'none';
        if (paso2) paso2.style.display = paso === 2 ? 'block' : 'none';
        if (paso3) paso3.style.display = paso === 3 ? 'block' : 'none';
    }
    
    function volverPaso1() {
        mostrarPasoRecuperacion(1);
        if (timerReenvio) {
            clearInterval(timerReenvio);
            timerReenvio = null;
        }
        const btnReenvio = document.getElementById('btn-reenviar-codigo');
        if (btnReenvio) {
            btnReenvio.disabled = false;
            btnReenvio.innerHTML = '<i class="fas fa-redo"></i> Reenviar código';
        }
    }
    
    function iniciarTemporizadorReenvio() {
        let segundos = 60;
        const btnReenvio = document.getElementById('btn-reenviar-codigo');
        
        if (!btnReenvio) return;
        
        btnReenvio.disabled = true;
        
        if (timerReenvio) clearInterval(timerReenvio);
        
        timerReenvio = setInterval(() => {
            segundos--;
            btnReenvio.innerHTML = `<i class="fas fa-clock"></i> Reenviar en ${segundos}s`;
            
            if (segundos <= 0) {
                clearInterval(timerReenvio);
                timerReenvio = null;
                btnReenvio.disabled = false;
                btnReenvio.innerHTML = '<i class="fas fa-redo"></i> Reenviar código';
            }
        }, 1000);
    }
    
    async function solicitarCodigoRecuperacion(event) {
        if (event) event.preventDefault();
        
        const email = document.getElementById('recuperacion-email').value.trim();
        
        if (!email || !isValidEmail(email)) {
            showToast('⚠️ Ingresa un correo válido', 'error');
            return;
        }
        
        emailRecuperacion = email;
        
        const btn = event && event.target ? event.target : document.querySelector('#paso-1-recuperacion .btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        }
        
        try {
            const res = await fetch('/api/recuperar-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            const data = await res.json();
            
            if (data.success) {
                showToast('📧 Si el correo existe, recibirás un código', 'success');
                mostrarPasoRecuperacion(2);
                iniciarTemporizadorReenvio();
            } else {
                showToast(data.message || 'Error', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Error de conexión', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar código';
            }
        }
    }
    
    async function verificarCodigoRecuperacion() {
        const codigo = document.getElementById('recuperacion-codigo').value.trim();
        
        if (!codigo || codigo.length !== 6) {
            showToast('⚠️ Ingresa el código de 6 dígitos', 'error');
            return;
        }
        
        try {
            const res = await fetch('/api/verificar-codigo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: emailRecuperacion, 
                    codigo 
                })
            });
            
            const data = await res.json();
            
            if (data.success) {
                showToast('✅ Código verificado', 'success');
                mostrarPasoRecuperacion(3);
                if (timerReenvio) {
                    clearInterval(timerReenvio);
                    timerReenvio = null;
                }
            } else {
                showToast(data.message || 'Código inválido', 'error');
                document.getElementById('recuperacion-codigo').value = '';
                document.getElementById('recuperacion-codigo').focus();
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Error de conexión', 'error');
        }
    }
    
    async function cambiarPasswordRecuperacion() {
        const nuevaPassword = document.getElementById('recuperacion-nueva-password').value;
        const confirmarPassword = document.getElementById('recuperacion-confirmar-password').value;
        const codigo = document.getElementById('recuperacion-codigo').value.trim();
        
        if (!nuevaPassword || nuevaPassword.length < 6) {
            showToast('⚠️ La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }
        
        if (nuevaPassword !== confirmarPassword) {
            showToast('⚠️ Las contraseñas no coinciden', 'error');
            return;
        }
        
        try {
            const res = await fetch('/api/cambiar-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: emailRecuperacion, 
                    codigo,
                    nueva_password: nuevaPassword
                })
            });
            
            const data = await res.json();
            
            if (data.success) {
                showToast('✅ Contraseña actualizada. Ya puedes iniciar sesión.', 'success');
                cerrarModalRecuperacion();
                
                // Rellenar el email en el formulario de login
                const loginEmail = document.getElementById('login-email');
                if (loginEmail) {
                    loginEmail.value = emailRecuperacion;
                    document.getElementById('login-password').focus();
                }
            } else {
                showToast(data.message || 'Error', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Error de conexión', 'error');
        }
    }
    
    function initForgotPassword() {
        if (!forgotPasswordLink) return;
        
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            abrirModalRecuperacion();
        });
    }
    
    // ========== CONTACTO (GUARDA EN BD) ==========
    function initContactForm() {
        const form = document.getElementById('form-contacto');
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('contacto-nombre')?.value.trim();
            const email = document.getElementById('contacto-email')?.value.trim();
            const telefono = document.getElementById('contacto-telefono')?.value.trim();
            const mensaje = document.getElementById('contacto-mensaje')?.value.trim();
            
            if (!nombre) { showToast('Ingresa tu nombre', 'error'); return; }
            if (!email || !isValidEmail(email)) { showToast('Email válido requerido', 'error'); return; }
            if (!mensaje || mensaje.length < 10) { showToast('Mensaje mínimo 10 caracteres', 'error'); return; }
            
            try {
                const res = await fetch('/api/contacto', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre, email, telefono: telefono || null, mensaje })
                });
                const data = await res.json();
                if (data.success) {
                    showToast('✅ ¡Mensaje enviado! Te contactaremos pronto.', 'success');
                    form.reset();
                } else {
                    showToast('Error al enviar. Intenta de nuevo.', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Error de conexión', 'error');
            }
        });
    }
    
    // ========== LOGIN ==========
    function initLoginForm() {
        const form = document.getElementById('login-form');
        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('login-email')?.value.trim();
            const password = document.getElementById('login-password')?.value;
            
            if (!email || !isValidEmail(email)) { 
                showToast('Email válido requerido', 'error'); 
                return; 
            }
            if (!password || password.length < 6) { 
                showToast('Contraseña mínimo 6 caracteres', 'error'); 
                return; 
            }
            
            // Mostrar modal de carga
            mostrarModalCargando(email);
            
            try {
                const res = await fetch('/api/login', { 
                    method:'POST', 
                    headers:{'Content-Type':'application/json'}, 
                    body:JSON.stringify({email, password}) 
                });
                const data = await res.json();
                
                if (data.success) {
                    currentUser = data.user;
                    localStorage.setItem('joyas_user', JSON.stringify(currentUser));
                    updateAuthUI();
                    
                    // Actualizar modal de carga con el nombre del usuario
                    const nombreUsuario = data.user.nombreCompleto || data.user.nombres || data.user.username;
                    const nombreUsuarioEl = document.getElementById('cargando-nombre-usuario');
                    const textoEl = document.getElementById('cargando-texto');
                    const barraEl = document.getElementById('cargando-barra-progreso');
                    
                    if (nombreUsuarioEl) nombreUsuarioEl.textContent = nombreUsuario;
                    if (textoEl) textoEl.textContent = '¡Credenciales verificadas! Cargando tu panel...';
                    if (barraEl) barraEl.style.width = '100%';
                    
                    // Esperar un momento para que se vea la animación
                    setTimeout(() => {
                        showToast(`¡Bienvenido, ${nombreUsuario}!`, 'success');
                        form.reset();
                        window.location.href = '/inicio.html';
                    }, 1500);
                    
                } else {
                    // Error de credenciales
                    cerrarModalCargando();
                    showToast(data.message || 'Credenciales incorrectas', 'error');
                }
            } catch (error) { 
                console.error('Error login:', error);
                cerrarModalCargando();
                showToast('Error de conexión', 'error'); 
            }
        });
    }
    
    function initLogout() {
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            currentUser = null;
            localStorage.removeItem('joyas_user');
            updateAuthUI();
            showToast('Sesión cerrada', 'success');
            goToHome();
        });
    }
    
    function checkSavedSession() {
        const saved = localStorage.getItem('joyas_user');
        if (saved) { 
            try { 
                currentUser = JSON.parse(saved); 
                updateAuthUI(); 
            } catch(e) { 
                localStorage.removeItem('joyas_user'); 
            } 
        }
    }
    
    // ========== NAVEGACIÓN ==========
    function initNavigation() {
        menuToggle?.addEventListener('click', () => { 
            mainNav?.classList.toggle('active'); 
        });
        
        document.addEventListener('click', (e) => { 
            if (mainNav?.classList.contains('active') && !mainNav.contains(e.target) && !menuToggle?.contains(e.target)) {
                closeMenu(); 
            }
            
            // Cerrar modal si se hace clic fuera
            const modal = document.getElementById('modal-recuperacion');
            if (modal && modal.style.display === 'flex' && e.target === modal) {
                cerrarModalRecuperacion();
            }
            
            // Cerrar modal de carga si se hace clic fuera (no recomendado, pero por seguridad)
            const modalCargando = document.getElementById('modal-cargando');
            if (modalCargando && modalCargando.style.display === 'flex' && e.target === modalCargando) {
                // No cerramos el modal de carga al hacer clic fuera
                // para evitar interrupciones durante el login
            }
        });
        
        navLinks.forEach(l => { 
            l.addEventListener('click', (e) => { 
                e.preventDefault(); 
                showPage(l.getAttribute('data-page')); 
            }); 
        });
        
        homeLink?.addEventListener('click', (e) => { e.preventDefault(); goToHome(); });
        footerHome?.addEventListener('click', (e) => { e.preventDefault(); goToHome(); });
        heroBtn?.addEventListener('click', (e) => { e.preventDefault(); goToHome(); });
        
        backHomeLinks.forEach(l => { 
            l.addEventListener('click', (e) => { e.preventDefault(); goToHome(); }); 
        });
        
        loginBtn?.addEventListener('click', (e) => { 
            e.preventDefault(); 
            showPage('login'); 
        });
    }
    
    function init() {
        updateYear();
        checkSavedSession();
        initNavigation();
        initContactForm();
        initLoginForm();
        initTogglePassword();
        initForgotPassword();
        initLogout();
        console.log('✅ Joyas Valentina listo');
    }
    
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

// ========== FUNCIONES GLOBALES PARA EL MODAL ==========
// Estas funciones deben ser globales para que funcionen con onclick en HTML

function solicitarCodigoRecuperacion(event) {
    const email = document.getElementById('recuperacion-email').value.trim();
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToastGlobal('⚠️ Ingresa un correo válido', 'error');
        return;
    }
    
    window.emailRecuperacion = email;
    
    const btn = event && event.target ? event.target : document.querySelector('#paso-1-recuperacion .btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    }
    
    fetch('/api/recuperar-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToastGlobal('📧 Si el correo existe, recibirás un código', 'success');
            document.getElementById('paso-1-recuperacion').style.display = 'none';
            document.getElementById('paso-2-recuperacion').style.display = 'block';
            iniciarTemporizadorReenvioGlobal();
        } else {
            showToastGlobal(data.message || 'Error', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToastGlobal('Error de conexión', 'error');
    })
    .finally(() => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar código';
        }
    });
}

function verificarCodigoRecuperacion() {
    const codigo = document.getElementById('recuperacion-codigo').value.trim();
    
    if (!codigo || codigo.length !== 6) {
        showToastGlobal('⚠️ Ingresa el código de 6 dígitos', 'error');
        return;
    }
    
    fetch('/api/verificar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            email: window.emailRecuperacion, 
            codigo 
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToastGlobal('✅ Código verificado', 'success');
            document.getElementById('paso-2-recuperacion').style.display = 'none';
            document.getElementById('paso-3-recuperacion').style.display = 'block';
            if (window.timerReenvio) {
                clearInterval(window.timerReenvio);
                window.timerReenvio = null;
            }
        } else {
            showToastGlobal(data.message || 'Código inválido', 'error');
            document.getElementById('recuperacion-codigo').value = '';
            document.getElementById('recuperacion-codigo').focus();
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToastGlobal('Error de conexión', 'error');
    });
}

function cambiarPasswordRecuperacion() {
    const nuevaPassword = document.getElementById('recuperacion-nueva-password').value;
    const confirmarPassword = document.getElementById('recuperacion-confirmar-password').value;
    const codigo = document.getElementById('recuperacion-codigo').value.trim();
    
    if (!nuevaPassword || nuevaPassword.length < 6) {
        showToastGlobal('⚠️ La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    if (nuevaPassword !== confirmarPassword) {
        showToastGlobal('⚠️ Las contraseñas no coinciden', 'error');
        return;
    }
    
    fetch('/api/cambiar-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            email: window.emailRecuperacion, 
            codigo,
            nueva_password: nuevaPassword
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToastGlobal('✅ Contraseña actualizada. Ya puedes iniciar sesión.', 'success');
            cerrarModalRecuperacion();
            
            const loginEmail = document.getElementById('login-email');
            if (loginEmail) {
                loginEmail.value = window.emailRecuperacion;
                document.getElementById('login-password').focus();
            }
        } else {
            showToastGlobal(data.message || 'Error', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToastGlobal('Error de conexión', 'error');
    });
}

function cerrarModalRecuperacion() {
    const modal = document.getElementById('modal-recuperacion');
    if (modal) {
        modal.style.display = 'none';
    }
    if (window.timerReenvio) {
        clearInterval(window.timerReenvio);
        window.timerReenvio = null;
    }
}

function volverPaso1() {
    document.getElementById('paso-1-recuperacion').style.display = 'block';
    document.getElementById('paso-2-recuperacion').style.display = 'none';
    document.getElementById('paso-3-recuperacion').style.display = 'none';
    
    if (window.timerReenvio) {
        clearInterval(window.timerReenvio);
        window.timerReenvio = null;
    }
    
    const btnReenvio = document.getElementById('btn-reenviar-codigo');
    if (btnReenvio) {
        btnReenvio.disabled = false;
        btnReenvio.innerHTML = '<i class="fas fa-redo"></i> Reenviar código';
    }
}

function iniciarTemporizadorReenvioGlobal() {
    let segundos = 60;
    const btnReenvio = document.getElementById('btn-reenviar-codigo');
    
    if (!btnReenvio) return;
    
    btnReenvio.disabled = true;
    
    if (window.timerReenvio) clearInterval(window.timerReenvio);
    
    window.timerReenvio = setInterval(() => {
        segundos--;
        btnReenvio.innerHTML = `<i class="fas fa-clock"></i> Reenviar en ${segundos}s`;
        
        if (segundos <= 0) {
            clearInterval(window.timerReenvio);
            window.timerReenvio = null;
            btnReenvio.disabled = false;
            btnReenvio.innerHTML = '<i class="fas fa-redo"></i> Reenviar código';
        }
    }, 1000);
}

function showToastGlobal(message, type = 'success') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i><span>${message}</span>`;
    toast.style.cssText = `position:fixed;bottom:30px;right:30px;background:${type==='success'?'#10b981':'#ef4444'};color:white;padding:14px 24px;border-radius:12px;display:flex;align-items:center;gap:12px;z-index:9999;animation:slideIn 0.3s ease;box-shadow:0 10px 25px rgba(0,0,0,0.2);font-weight:500;cursor:pointer;`;
    document.body.appendChild(toast);
    toast.addEventListener('click', () => toast.remove());
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3000);
}