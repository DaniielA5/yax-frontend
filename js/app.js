/* ============================================================
   YAX ESTUDIO — app.js v2
   ============================================================ */

const API = 'http://localhost:3000';

let sesionActual      = JSON.parse(localStorage.getItem('sesionActual')) || null;
let catalogoProductos = [];
let productosVenta    = [];   // { id_producto, nombre, precio_unitario, cantidad }
let ventaParaDevolver = null;
let productoEditandoId = null;
let metodoPagoSeleccionado = null;
let timerInterval = null;

/* ---- UTILIDADES ------------------------------------------ */
const $ = id => document.getElementById(id);

const mostrarError = (id, msg) => {
  const el = $(id);
  el.textContent = msg;
  el.classList.remove('oculto');
  setTimeout(() => el.classList.add('oculto'), 4000);
};

const irA = pantalla => {
  document.querySelectorAll('.pantalla').forEach(p => {
    p.classList.add('oculto');
    p.classList.remove('activa');
  });
  const destino = $(pantalla);
  destino.classList.remove('oculto');
  destino.classList.add('activa');
};

const scrollToSection = (selector) => {
  const el = document.querySelector(selector) || $(selector.replace('#','').replace('.',''));
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/* ---- TEMA (LIGHT / DARK) --------------------------------- */
const aplicarTema = (tema) => {
  document.documentElement.setAttribute('data-theme', tema);
  localStorage.setItem('tema', tema);

  // Cambiar logo según tema
  const logoLogin  = $('logo-login');
  const logoHeader = $('logo-header');
  const src = tema === 'dark' ? 'img/logoYAXWhite.png' : 'img/logoYAXBlack.png';
  if (logoLogin)  logoLogin.src  = src;
  if (logoHeader) logoHeader.src = src;

  // Actualizar toggle en sidebar
  const track = $('sb-toggle-track');
  const icon  = $('sb-mode-icon');
  const label = $('sb-mode-label');
  if (track) track.className = 'sb-toggle-track' + (tema === 'dark' ? ' on' : '');
  if (icon)  icon.textContent  = tema === 'dark' ? '  ' : '  ';
  //link pensindete imqgnes 
  if (label) label.textContent = tema === 'dark' ? 'Modo claro' : 'Modo oscuro';
};

const toggleTheme = () => {
  const actual = document.documentElement.getAttribute('data-theme') || 'light';
  aplicarTema(actual === 'dark' ? 'light' : 'dark');
};

// Aplicar tema guardado al cargar
aplicarTema(localStorage.getItem('tema') || 'light');

/* ---- SIDEBAR --------------------------------------------- */
const abrirMenu = () => {
  $('sidebar').classList.add('open');
  $('sidebar-overlay').classList.add('open');
};

const cerrarMenu = () => {
  $('sidebar').classList.remove('open');
  $('sidebar-overlay').classList.remove('open');
};

const actualizarSidebar = () => {
  if (!sesionActual) return;
  const inicial = sesionActual.usuario.charAt(0).toUpperCase();
  $('sb-avatar').textContent    = inicial;
  $('sb-nombre').textContent    = sesionActual.usuario;
  $('sb-sesion-meta').textContent = `Sesión #${sesionActual.id}`;
};

const iniciarTimer = () => {
  if (timerInterval) clearInterval(timerInterval);
  const actualizar = () => {
    if (!sesionActual?.fechaInicio) return;
    const diff = Date.now() - sesionActual.fechaInicio;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const timerEl = $('sb-timer');
    if (timerEl) timerEl.textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
  };
  actualizar();
  timerInterval = setInterval(actualizar, 30000);
};

/* ---- CARGAR SESIÓN AL INICIO ----------------------------- */
window.addEventListener('load', async () => {
  if (!sesionActual) return;
  try {
    const res  = await fetch(`${API}/sesion/${sesionActual.id}/resumen`);
    const data = await res.json();
    if (data.estado === 'CERRADA' || !res.ok) {
      localStorage.removeItem('sesionActual');
      sesionActual = null;
      irA('pantalla-sesion');
      return;
    }
    $('info-sesion').textContent = `Cajero: ${sesionActual.usuario} · Sesión #${sesionActual.id}`;
    irA('pantalla-principal');
    actualizarSidebar();
    iniciarTimer();
    await Promise.all([cargarCatalogo(), cargarCategorias(), cargarMetodosPago(), cargarProductosAdmin()]);
    actualizarResumen();
    actualizarHistorial();
  } catch (e) {
    localStorage.removeItem('sesionActual');
    sesionActual = null;
    irA('pantalla-sesion');
  }
});

/* ---- ABRIR SESIÓN ---------------------------------------- */
$('btn-abrir-sesion').addEventListener('click', async () => {
  const usuario      = $('input-usuario').value.trim();
  const monto_inicial = parseFloat($('input-monto').value);

  if (!usuario) return mostrarError('error-sesion', 'Ingresa el nombre del cajero');
  if (isNaN(monto_inicial) || monto_inicial < 0) return mostrarError('error-sesion', 'Ingresa un fondo válido');

  try {
    const res  = await fetch(`${API}/sesion/abrir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, monto_inicial })
    });
    const data = await res.json();
    if (!res.ok) return mostrarError('error-sesion', data.error);

    sesionActual = { id: data.id_sesion, usuario, monto_inicial, fechaInicio: Date.now() };
    localStorage.setItem('sesionActual', JSON.stringify(sesionActual));

    $('info-sesion').textContent = `Cajero: ${usuario} · Sesión #${data.id_sesion}`;
    irA('pantalla-principal');
    actualizarSidebar();
    iniciarTimer();
    await Promise.all([cargarCatalogo(), cargarCategorias(), cargarMetodosPago(), cargarProductosAdmin()]);
    actualizarResumen();
  } catch (e) {
    mostrarError('error-sesion', 'No se pudo conectar al servidor');
  }
});

/* ---- RESUMEN DE CAJA ------------------------------------- */
const actualizarResumen = async () => {
  try {
    const res  = await fetch(`${API}/sesion/${sesionActual.id}/resumen`);
    const data = await res.json();
    $('resumen-fondo').textContent         = parseFloat(data.monto_inicial).toFixed(2);
    $('resumen-efectivo').textContent      = parseFloat(data.ingreso_efectivo).toFixed(2);
    $('resumen-transferencia').textContent = parseFloat(data.ingreso_transferencia).toFixed(2);
    $('resumen-ingresos').textContent      = parseFloat(data.total_ingresos).toFixed(2);
    $('resumen-egresos').textContent       = parseFloat(data.total_egresos).toFixed(2);
    $('resumen-total').textContent         = parseFloat(data.debe_haber_en_caja).toFixed(2);
  } catch (e) {
    console.error('Error al actualizar resumen', e);
  }
};

/* ---- CATÁLOGO -------------------------------------------- */
const cargarCatalogo = async () => {
  try {
    const res = await fetch(`${API}/venta/productos`);
    catalogoProductos = await res.json();
  } catch (e) {
    console.error('Error al cargar catálogo', e);
  }
};

/* ---- CARRITO --------------------------------------------- */
const renderCarrito = () => {
  const lista = $('lista-productos');
  lista.innerHTML = '';

  if (productosVenta.length === 0) {
    lista.innerHTML = '<p class="vacio" style="padding:12px">Sin productos</p>';
    $('total-venta').textContent = '0.00';
    return;
  }

  let total = 0;
  productosVenta.forEach((item, i) => {
    const subtotal = item.cantidad * item.precio_unitario;
    total += subtotal;
    const div = document.createElement('div');
    div.className = 'cart-row';
    div.innerHTML = `
      <span class="cart-name" title="${item.nombre}">${item.nombre}</span>
      <div class="cart-qty">
        <button class="qty-btn" onclick="cambiarCantidad(${i}, -1)">−</button>
        <span class="qty-num">${item.cantidad}</span>
        <button class="qty-btn" onclick="cambiarCantidad(${i}, 1)">+</button>
      </div>
      <span class="cart-price">$${subtotal.toFixed(2)}</span>
      <button class="btn-quitar" onclick="quitarDelCarrito(${i})" title="Quitar">✕</button>
    `;
    lista.appendChild(div);
  });

  $('total-venta').textContent = total.toFixed(2);
};

const agregarAlCarrito = (producto) => {
  const existente = productosVenta.find(p => p.id_producto === producto.id_producto);
  if (existente) {
    existente.cantidad++;
  } else {
    productosVenta.push({
      id_producto:    producto.id_producto,
      nombre:         producto.nombre,
      precio_unitario: parseFloat(producto.precio_venta),
      cantidad:       1
    });
  }
  renderCarrito();
};

const cambiarCantidad = (index, delta) => {
  productosVenta[index].cantidad += delta;
  if (productosVenta[index].cantidad <= 0) productosVenta.splice(index, 1);
  renderCarrito();
};

const quitarDelCarrito = (index) => {
  productosVenta.splice(index, 1);
  renderCarrito();
};

/* ---- BUSCADOR DE PRODUCTOS ------------------------------- */
$('input-buscar-producto').addEventListener('input', function () {
  const query    = this.value.trim().toLowerCase();
  const dropdown = $('search-dropdown');

  if (!query) { dropdown.classList.add('oculto'); return; }

  const resultados = catalogoProductos.filter(p =>
    p.nombre.toLowerCase().includes(query)
  );

  if (resultados.length === 0) { dropdown.classList.add('oculto'); return; }

  const idsEnCarrito = new Set(productosVenta.map(p => p.id_producto));

  dropdown.innerHTML = resultados.map(p => {
    const estaEnCarrito = idsEnCarrito.has(p.id_producto);
    return `
      <div class="dd-item ${estaEnCarrito ? 'ya-en-carrito' : ''}"
           onclick="seleccionarProducto(${p.id_producto})">
        <span class="dd-name">${p.nombre}</span>
        <div style="display:flex;align-items:center;gap:6px">
          ${estaEnCarrito ? '<span class="dd-check">✓ En carrito</span>' : ''}
          <span class="dd-price">$${parseFloat(p.precio_venta).toFixed(2)}</span>
        </div>
      </div>
    `;
  }).join('');

  dropdown.classList.remove('oculto');
});

const seleccionarProducto = (id) => {
  const producto = catalogoProductos.find(p => p.id_producto === id);
  if (producto) {
    agregarAlCarrito(producto);
    $('input-buscar-producto').value = '';
    $('search-dropdown').classList.add('oculto');
  }
};

// Cerrar dropdown al hacer click fuera
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrapper')) {
    $('search-dropdown').classList.add('oculto');
  }
});

/* ---- MODAL PAGO ------------------------------------------ */
$('btn-registrar-venta').addEventListener('click', () => {
  if (productosVenta.length === 0) {
    return mostrarError('error-venta', 'Agrega al menos un producto');
  }
  const total = productosVenta.reduce((sum, p) => sum + p.cantidad * p.precio_unitario, 0);
  $('modal-pago-total').textContent = `$${total.toFixed(2)}`;
  metodoPagoSeleccionado = null;
  document.querySelectorAll('.metodo-btn').forEach(b => b.classList.remove('selected'));
  $('modal-pago').classList.remove('oculto');
});

const seleccionarMetodoPago = (id) => {
  metodoPagoSeleccionado = id;
  document.querySelectorAll('.metodo-btn').forEach(b => {
    b.classList.toggle('selected', parseInt(b.dataset.id) === id);
  });
};

const cerrarModalPago = () => {
  $('modal-pago').classList.add('oculto');
  metodoPagoSeleccionado = null;
};

$('btn-confirmar-pago').addEventListener('click', async () => {
  if (!metodoPagoSeleccionado) {
    return mostrarError('error-pago', 'Selecciona un método de pago');
  }

  const productos = productosVenta.map(p => ({
    id_producto:    p.id_producto,
    cantidad:       p.cantidad,
    precio_unitario: p.precio_unitario
  }));

  try {
    const resVenta = await fetch(`${API}/venta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_sesion: sesionActual.id, productos })
    });
    const dataVenta = await resVenta.json();
    if (!resVenta.ok) { cerrarModalPago(); return mostrarError('error-venta', dataVenta.error); }

    const resPago = await fetch(`${API}/venta/${dataVenta.id_venta}/pagar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_sesion:      sesionActual.id,
        id_metodo_pago: metodoPagoSeleccionado,
        monto:          dataVenta.total
      })
    });
    const dataPago = await resPago.json();
    if (!resPago.ok) { cerrarModalPago(); return mostrarError('error-venta', dataPago.error); }

    cerrarModalPago();
    productosVenta = [];
    renderCarrito();
    actualizarResumen();
    actualizarHistorial();
    alert(`✓ Venta registrada — $${dataVenta.total}`);
  } catch (e) {
    mostrarError('error-pago', 'Error al conectar con el servidor');
  }
});

/* ---- GASTOS ---------------------------------------------- */
const cargarCategorias = async () => {
  try {
    const res       = await fetch(`${API}/venta/categorias-gasto`);
    const categorias = await res.json();
    $('select-categoria').innerHTML = categorias.map(c =>
      `<option value="${c.id_categoria_gasto}">${c.nombre}</option>`
    ).join('');
  } catch (e) {
    console.error('Error al cargar categorías', e);
  }
};

$('btn-registrar-gasto').addEventListener('click', async () => {
  const id_categoria_gasto = parseInt($('select-categoria').value);
  const monto              = parseFloat($('input-monto-gasto').value);
  const descripcion        = $('input-descripcion-gasto').value.trim();

  if (!monto || monto <= 0) return mostrarError('error-gasto', 'Ingresa un monto válido');

  try {
    const res  = await fetch(`${API}/venta/gasto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_sesion: sesionActual.id, id_categoria_gasto, monto, descripcion, id_metodo_pago: 1 })
    });
    const data = await res.json();
    if (!res.ok) return mostrarError('error-gasto', data.error);

    $('input-monto-gasto').value       = '';
    $('input-descripcion-gasto').value = '';
    actualizarResumen();
    alert(` Gasto registrado — $${monto}`);
  } catch (e) {
    mostrarError('error-gasto', 'Error al conectar con el servidor');
  }
});

/* ---- HISTORIAL ------------------------------------------- */
const actualizarHistorial = async () => {
  try {
    const res   = await fetch(`${API}/sesion/${sesionActual.id}/historial`);
    const ventas = await res.json();
    const lista  = $('lista-historial');

    if (ventas.length === 0) {
      lista.innerHTML = '<p class="vacio">Sin ventas aún</p>';
      return;
    }

    lista.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Hora</th>
            <th>Productos</th>
            <th>Total</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${ventas.map(v => `
            <tr>
              <td>${v.id_venta}</td>
              <td>${new Date(v.fecha).toLocaleTimeString()}</td>
              <td style="font-size:0.78rem;color:var(--text-3)">
                ${v.productos.map(p => `${p.nombre} x${p.cantidad}`).join(', ')}
              </td>
              <td><strong>$${parseFloat(v.total).toFixed(2)}</strong></td>
              <td><span class="estado-${v.estado}">${v.estado}</span></td>
              <td>
                ${v.estado === 'PAGADA'
                  ? `<button onclick='abrirModalDevolucion(${JSON.stringify(v)})'
                       style="width:auto;padding:4px 10px;font-size:0.75rem;"
                       class="btn-secondary">Devolver</button>`
                  : '—'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    console.error('Error al cargar historial', e);
  }
};

/* ---- CERRAR SESIÓN --------------------------------------- */
$('btn-cerrar-sesion').addEventListener('click', async () => {
  try {
    const res  = await fetch(`${API}/sesion/${sesionActual.id}/resumen`);
    const data = await res.json();

    $('cierre-usuario').textContent  = data.usuario;
    $('cierre-sesion').textContent   = `#${sesionActual.id}`;
    $('cierre-inicio').textContent   = new Date(data.fecha_inicio).toLocaleTimeString();
    $('cierre-fondo').textContent    = `$${parseFloat(data.monto_inicial).toFixed(2)}`;
    $('cierre-ingresos').textContent = `$${parseFloat(data.total_ingresos).toFixed(2)}`;
    $('cierre-egresos').textContent  = `$${parseFloat(data.total_egresos).toFixed(2)}`;
    $('cierre-total').textContent    = `$${parseFloat(data.debe_haber_en_caja).toFixed(2)}`;

    irA('pantalla-cierre');
  } catch (e) {
    alert('Error al obtener resumen');
  }
});

$('btn-confirmar-cierre').addEventListener('click', async () => {
  try {
    const res  = await fetch(`${API}/sesion/${sesionActual.id}/resumen`);
    const data = await res.json();

    const resCierre = await fetch(`${API}/sesion/cerrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_sesion: sesionActual.id, monto_final_real: data.debe_haber_en_caja })
    });
    const dataCierre = await resCierre.json();
    if (!resCierre.ok) return alert(dataCierre.error);

    if (timerInterval) clearInterval(timerInterval);
    sesionActual = null;
    productosVenta = [];
    localStorage.removeItem('sesionActual');
    irA('pantalla-sesion');
  } catch (e) {
    alert('Error al cerrar sesión');
  }
});

$('btn-cancelar-cierre').addEventListener('click', () => irA('pantalla-principal'));

/* ---- DEVOLUCIONES ---------------------------------------- */
const abrirModalDevolucion = (venta) => {
  ventaParaDevolver = venta;
  $('modal-venta-info').textContent = `Venta #${venta.id_venta} — $${parseFloat(venta.total).toFixed(2)}`;

  $('modal-productos-devolucion').innerHTML = venta.productos.map((p, i) => `
    <div class="devolucion-item">
      <span>${p.nombre}</span>
      <span style="color:var(--text-3)">x${p.cantidad} · $${parseFloat(p.precio_unitario).toFixed(2)}</span>
      <input type="number" min="0" max="${p.cantidad}" value="0" id="dev-cantidad-${i}" />
    </div>
  `).join('');

  $('modal-devolucion').classList.remove('oculto');
};

$('btn-cancelar-devolucion').addEventListener('click', () => {
  $('modal-devolucion').classList.add('oculto');
  ventaParaDevolver = null;
});

$('btn-confirmar-devolucion').addEventListener('click', async () => {
  const productos = ventaParaDevolver.productos
    .map((p, i) => ({
      id_producto:    p.id_producto,
      cantidad:       parseInt($(`dev-cantidad-${i}`).value) || 0,
      precio_unitario: parseFloat(p.precio_unitario)
    }))
    .filter(p => p.cantidad > 0);

  if (productos.length === 0) {
    return mostrarError('error-devolucion', 'Ingresa al menos una cantidad a devolver');
  }

  try {
    const res  = await fetch(`${API}/venta/${ventaParaDevolver.id_venta}/devolucion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_sesion:      sesionActual.id,
        motivo:         'Devolución registrada desde caja',
        productos,
        id_metodo_pago: parseInt($('select-metodo-devolucion').value)
      })
    });
    const data = await res.json();
    if (!res.ok) return mostrarError('error-devolucion', data.error);

    $('modal-devolucion').classList.add('oculto');
    ventaParaDevolver = null;
    actualizarResumen();
    actualizarHistorial();
    alert(` Devolución registrada — $${data.total_devuelto}`);
  } catch (e) {
    mostrarError('error-devolucion', 'Error al conectar con el servidor');
  }
});

const cargarMetodosPago = async () => {
  try {
    const res    = await fetch(`${API}/venta/metodos-pago`);
    const metodos = await res.json();
    const opciones = metodos.map(m =>
      `<option value="${m.id_metodo_pago}">${m.nombre}</option>`
    ).join('');
    $('select-metodo-devolucion').innerHTML = opciones;
  } catch (e) {
    console.error('Error al cargar métodos de pago', e);
  }
};

/* ---- CRUD PRODUCTOS -------------------------------------- */
const cargarProductosAdmin = async () => {
  try {
    const res      = await fetch(`${API}/venta/productos?todos=1`);
    const productos = await res.json();
    const contenedor = $('lista-productos-admin');

    if (productos.length === 0) {
      contenedor.innerHTML = '<p class="vacio">Sin productos aún</p>';
      return;
    }

    contenedor.innerHTML = `<div class="productos-grid">
      ${productos.map(p => `
        <div class="producto-card">
          <h3>${p.nombre}</h3>
          <span class="precio">$${parseFloat(p.precio_venta).toFixed(2)}</span>
          <span class="costo">Costo: $${parseFloat(p.costo_produccion || 0).toFixed(2)}</span>
          <div class="producto-card-acciones">
            <button class="btn-editar"
              onclick="abrirModalEditar(${p.id_producto},'${p.nombre.replace(/'/g,"\\'")}',${p.costo_produccion},${p.precio_venta},${p.id_tipo_producto})">
              Editar
            </button>
            <button class="btn-desactivar"
              onclick="confirmarDesactivar(${p.id_producto},'${p.nombre.replace(/'/g,"\\'")}')">
              Quitar
            </button>
          </div>
        </div>
      `).join('')}
    </div>`;
  } catch (e) {
    console.error('Error al cargar productos admin', e);
  }
};

const cargarTiposProducto = async () => {
  try {
    const res   = await fetch(`${API}/venta/tipos-producto`);
    const tipos = await res.json();
    $('prod-tipo').innerHTML = tipos.map(t =>
      `<option value="${t.id_tipo_producto}">${t.nombre}</option>`
    ).join('');
  } catch (e) {
    console.error('Error al cargar tipos', e);
  }
};

const abrirModalNuevo = () => {
  productoEditandoId = null;
  $('modal-producto-titulo').textContent = 'Nuevo Producto';
  $('prod-nombre').value = '';
  $('prod-costo').value  = '';
  $('prod-precio').value = '';
  $('modal-producto').classList.remove('oculto');
};

const abrirModalEditar = (id, nombre, costo, precio, idTipo) => {
  productoEditandoId = id;
  $('modal-producto-titulo').textContent = 'Editar Producto';
  $('prod-nombre').value = nombre;
  $('prod-costo').value  = costo;
  $('prod-precio').value = precio;
  $('prod-tipo').value   = idTipo;
  $('modal-producto').classList.remove('oculto');
};

const confirmarDesactivar = async (id, nombre) => {
  if (!confirm(`¿Desactivar "${nombre}"?`)) return;
  try {
    const res  = await fetch(`${API}/venta/productos/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    cargarProductosAdmin();
    cargarCatalogo();
  } catch (e) {
    alert('Error al desactivar producto');
  }
};

$('btn-nuevo-producto').addEventListener('click', () => {
  cargarTiposProducto().then(abrirModalNuevo);
});

$('btn-cancelar-producto').addEventListener('click', () => {
  $('modal-producto').classList.add('oculto');
});

$('btn-guardar-producto').addEventListener('click', async () => {
  const nombre           = $('prod-nombre').value.trim();
  const costo_produccion = parseFloat($('prod-costo').value) || 0;
  const precio_venta     = parseFloat($('prod-precio').value);
  const id_tipo_producto = parseInt($('prod-tipo').value);

  if (!nombre)                    return mostrarError('error-producto', 'El nombre es requerido');
  if (!precio_venta || precio_venta <= 0) return mostrarError('error-producto', 'El precio debe ser mayor a cero');

  const url    = productoEditandoId ? `${API}/venta/productos/${productoEditandoId}` : `${API}/venta/productos`;
  const method = productoEditandoId ? 'PUT' : 'POST';

  try {
    const res  = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_tipo_producto, nombre, costo_produccion, precio_venta })
    });
    const data = await res.json();
    if (!res.ok) return mostrarError('error-producto', data.error);
    $('modal-producto').classList.add('oculto');
    cargarProductosAdmin();
    cargarCatalogo();
  } catch (e) {
    mostrarError('error-producto', 'Error al conectar con el servidor');
  }
});