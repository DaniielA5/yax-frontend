

const API = 'http://localhost:3000';
let sesionActual = JSON.parse(localStorage.getItem('sesionActual')) || null;

// --- UTILIDADES ---
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

window.addEventListener('load', async () => {
  cargarProductosAdmin();
  if (sesionActual) {
    try{
      const res = await fetch(`${API}/sesion/${sesionActual.id}/resumen`);
      const data = await res.json();

      if(data.estado === 'CERRADA' || !res.ok){
        localStorage.removeItem('sesionActual');
        sesionActual = null ;
        irA('pantalla-sesion');
        return ; 
      } 
    $('info-sesion').textContent = `Cajero: ${sesionActual.usuario} | Sesión #${sesionActual.id}`;
    irA('pantalla-principal');
    actualizarResumen();
    cargarCatalogo();
    actualizarHistorial()
    cargarCategorias();
    cargarMetodosPago();

  }catch(e){
    localStorage.removeItem('sesionactual');
    sesionActual = null ; 
    irA('pantalla-sesion');
  }
}
});
// --- ABRIR SESIÓN ---
$('btn-abrir-sesion').addEventListener('click', async () => {
  cargarProductosAdmin();
  const usuario = $('input-usuario').value.trim();
  const monto_inicial = parseFloat($('input-monto').value);

  if (!usuario) return mostrarError('error-sesion', 'Ingresa el nombre del cajero');
  if (isNaN(monto_inicial) || monto_inicial < 0) return mostrarError('error-sesion', 'Ingresa un fondo válido');

  try {
    const res = await fetch(`${API}/sesion/abrir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, monto_inicial })
    });
    const data = await res.json();

    if (!res.ok) return mostrarError('error-sesion', data.error);

    sesionActual = { id: data.id_sesion, usuario, monto_inicial };
    localStorage.setItem('sesionActual', JSON.stringify(sesionActual)); // agrega esto
    $('info-sesion').textContent = `Cajero: ${usuario} | Sesión #${data.id_sesion}`;
    irA('pantalla-principal');
    cargarCatalogo();
    cargarCategorias();
    actualizarResumen();
    cargarMetodosPago();

    
  } catch (e) {
    mostrarError('error-sesion', 'No se pudo conectar al servidor');
  }
});

// --- RESUMEN DE CAJA ---
const actualizarResumen = async () => {
  try {
    const res = await fetch(`${API}/sesion/${sesionActual.id}/resumen`);
    const data = await res.json();
    
    $('resumen-fondo').textContent        = parseFloat(data.monto_inicial).toFixed(2);
    $('resumen-efectivo').textContent     = parseFloat(data.ingreso_efectivo).toFixed(2);
    $('resumen-transferencia').textContent= parseFloat(data.ingreso_transferencia).toFixed(2);
    $('resumen-ingresos').textContent     = parseFloat(data.total_ingresos).toFixed(2);
    $('resumen-egresos').textContent      = parseFloat(data.total_egresos).toFixed(2);
    $('resumen-total').textContent        = parseFloat(data.debe_haber_en_caja).toFixed(2);
  } catch (e) {
    console.error('Error al actualizar resumen', e);
  }
};
// productos de vent a
// --- PRODUCTOS EN VENTA ---
let productosVenta = [];
let catalogoProductos = [];

    const cargarCatalogo = async () => {
    try {
      const res = await fetch(`${API}/venta/productos`);
      catalogoProductos = await res.json();
    } catch (e) {
      console.error('Error al cargar catálogo', e);
    }
    };
const renderizarProductos = () => {
  const lista = $('lista-productos');
  lista.innerHTML = '';
  let total = 0;

  productosVenta.forEach((item, index) => {
    total += (item.cantidad || 0) * (item.precio_unitario || 0);
    const div = document.createElement('div');
    div.className = 'producto-row';

    const opciones = catalogoProductos.map(p => `
      <option value="${p.id_producto}" 
        data-precio="${p.precio_venta}"
        ${item.id_producto === p.id_producto ? 'selected' : ''}>
        ${p.nombre} — $${p.precio_venta}
      </option>
    `).join('');

    div.innerHTML = `
      <select onchange="
        const duplicado = productosVenta.some((p, i) => i !== ${index} && p.id_producto === parseInt(this.value));
        if (duplicado) {
          alert('Ese producto ya está en la venta');
          this.value = productosVenta[${index}].id_producto;
          return;
        }
        productosVenta[${index}].id_producto = parseInt(this.value);
        productosVenta[${index}].precio_unitario = parseFloat(this.options[this.selectedIndex].dataset.precio);
        renderizarProductos();
      ">
        <option value="">-- Selecciona --</option>
        ${opciones}
      </select>
      <input type="number" placeholder="Cantidad" value="${item.cantidad || ''}"
        onchange="productosVenta[${index}].cantidad = parseInt(this.value); renderizarProductos()" min="1"/>
      <span class="precio-unitario">$${(item.precio_unitario || 0).toFixed(2)}</span>
      <button class="btn-quitar" onclick="productosVenta.splice(${index}, 1); renderizarProductos()">✕</button>
    `;
    lista.appendChild(div);
  });

  $('total-venta').textContent = total.toFixed(2);
};
$('btn-agregar-producto').addEventListener('click', () => {
  productosVenta.push({ id_producto: null, cantidad: null, precio_unitario: null });
  renderizarProductos();
});

// --- REGISTRAR Y COBRAR ---
$('btn-registrar-venta').addEventListener('click', async () => {
  if (productosVenta.length === 0) {
    return mostrarError('error-venta', 'Agrega al menos un producto');
  }
  const hayPrecioVacio = productosVenta.some(p => p.precio_unitario <= 0);
  if (hayPrecioVacio) {
    return mostrarError('error-venta', 'Todos los productos deben tener precio mayor a cero');
  }
const hayIdVacio = productosVenta.some(p => !p.id_producto);
if (hayIdVacio) return mostrarError('error-venta', 'Todos los productos deben tener ID');
  try {
    // Crear la venta
    const resVenta = await fetch(`${API}/venta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_sesion: sesionActual.id, productos: productosVenta })
    });
    const dataVenta = await resVenta.json();
    if (!resVenta.ok) return mostrarError('error-venta', dataVenta.error);

    // Pagar la venta automáticamente con efectivo (id_metodo_pago: 1)
    const resPago = await fetch(`${API}/venta/${dataVenta.id_venta}/pagar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
         id_sesion: sesionActual.id,
         id_metodo_pago: parseInt($('select-metodo-venta').value),
         monto: dataVenta.total
         })
    });
    const dataPago = await resPago.json();
    if (!resPago.ok) return mostrarError('error-venta', dataPago.error);

    // Limpiar y actualizar
    productosVenta = [];
    
    renderizarProductos();
    actualizarResumen();
    actualizarHistorial();
    alert(` Venta registrada — Total: $${dataVenta.total}`);
  } catch (e) {
    mostrarError('error-venta', 'Error al conectar con el servidor');
  }
});

// --- CERRAR SESIÓN ---
$('btn-cerrar-sesion').addEventListener('click', async () => {
  const confirmar = confirm('¿Cerrar la caja? Esta acción no se puede deshacer.');
  if (!confirmar) return;

  try {
    const resumen = await fetch(`${API}/sesion/${sesionActual.id}/resumen`);
    const data = await resumen.json();

    const resCierre = await fetch(`${API}/sesion/cerrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_sesion: sesionActual.id, monto_final_real: data.debe_haber_en_caja })
    });
    const dataCierre = await resCierre.json();

    if (!resCierre.ok) {
      alert(dataCierre.error);
    } else {
      alert(`Caja cerrada. En caja: $${data.debe_haber_en_caja}`);
    }
  } catch (e) {
    alert('Error al conectar con el servidor');
  } finally {
    sesionActual = null;
    localStorage.removeItem('sesionActual');
    irA('pantalla-sesion');
  }
});

$('btn-confirmar-cierre').addEventListener('click', async () => {
  try {
    const res = await fetch(`${API}/sesion/${sesionActual.id}/resumen`);
    const data = await res.json();

    const resCierre = await fetch(`${API}/sesion/cerrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_sesion: sesionActual.id,
        monto_final_real: data.debe_haber_en_caja
      })
    });

    const dataCierre = await resCierre.json();
    if (!resCierre.ok) return alert(dataCierre.error);
        sesionActual = null;
    localStorage.removeItem('sesionActual');
    irA('pantalla-sesion');
  } catch (e) {
    alert('Error al cerrar sesión');
  }
});

$('btn-cancelar-cierre').addEventListener('click', () => {
  irA('pantalla-principal');
});



const cargarCategorias = async () => {
  try {
    const res = await fetch(`${API}/venta/categorias-gasto`);
    const categorias = await res.json();
    const select = $('select-categoria');
    select.innerHTML = categorias.map(c =>
      `<option value="${c.id_categoria_gasto}">${c.nombre}</option>`
    ).join('');
  } catch (e) {
    console.error('Error al cargar categorías', e);
  }
};

$('btn-registrar-gasto').addEventListener('click', async()=>{
  const id_categoria_gasto =parseInt($('select-categoria').value);
  const monto = parseFloat($('input-monto-gasto').value);
  const descripcion = $('input-descripcion-gasto').value.trim();
  
  if(!monto || monto <= 0 ) return mostrarError('error-gasto', 'Ingresaun monto valido');
    try {
    const res = await fetch(`${API}/venta/gasto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_sesion: sesionActual.id,
        id_categoria_gasto,
        monto,
        descripcion,
        id_metodo_pago: 1
      })
    });
    const data = await res.json();
    if (!res.ok) return mostrarError('error-gasto', data.error);

    $('input-monto-gasto').value = '';
    $('input-descripcion-gasto').value = '';
    actualizarResumen();
    alert(` Gasto registrado — $${monto}`);
  } catch (e) {
    mostrarError('error-gasto', 'Error al conectar con el servi');
  }
});

const actualizarHistorial = async () => {
  try {
    const res = await fetch(`${API}/sesion/${sesionActual.id}/historial`);
    const ventas = await res.json();
    const lista = $('lista-historial');

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
                <td style="font-size:0.8rem; color:#aaa">
                  ${v.productos.map(p => `${p.nombre} x${p.cantidad}`).join(', ')}
                </td>
                <td>$${parseFloat(v.total).toFixed(2)}</td>
                <td class="estado-${v.estado}">${v.estado}</td>
                <td>
                  ${v.estado === 'PAGADA' 
                    ? `<button 
                        onclick='abrirModalDevolucion(${JSON.stringify(v)})' 
                        style="padding:4px 10px; font-size:0.8rem; background:#3b82f6">
                        Devolver
                      </button>` 
                    : '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
  } catch (e) {
    console.error('Error al cargar historial', e);
  }};


  // --- DEVOLUCIONES ---
let ventaParaDevolver = null;

const abrirModalDevolucion = (venta) => {
  ventaParaDevolver = venta;
  $('modal-venta-info').textContent = `Venta #${venta.id_venta} — Total: $${parseFloat(venta.total).toFixed(2)}`;

  const contenedor = $('modal-productos-devolucion');
  contenedor.innerHTML = venta.productos.map((p, i) => `
    <div class="devolucion-item">
      <span>${p.nombre}</span>
      <span style="color:#888">x${p.cantidad} — $${parseFloat(p.precio_unitario).toFixed(2)}</span>
      <input 
        type="number" 
        min="0" 
        max="${p.cantidad}" 
        value="0"
        id="dev-cantidad-${i}"
        placeholder="0"
      />
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
      id_producto: p.id_producto,
      cantidad: parseInt($(`dev-cantidad-${i}`).value) || 0,
      precio_unitario: parseFloat(p.precio_unitario)
    }))
    .filter(p => p.cantidad > 0);  // solo los que tienen cantidad > 0

  if (productos.length === 0) {
    return mostrarError('error-devolucion', 'Ingresa al menos una cantidad a devolver');
  }

  try {
    const res = await fetch(`${API}/venta/${ventaParaDevolver.id_venta}/devolucion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_sesion: sesionActual.id,
        motivo: 'Devolución registrada desde caja',
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
    alert(`Devolución registrada — $${data.total_devuelto} devueltos`);
  } catch (e) {
    mostrarError('error-devolucion', 'Error al conectar con el servidor');
  }
});

const cargarMetodosPago = async() => { 
  try{
    const res = await fetch(`${API}/venta/metodos-pago`);
    const metodos  =  await res.json();

    const opciones = metodos.map(m =>
      `<option value="${m.id_metodo_pago}">${m.nombre}</option>`
    ).join('');

    $('select-metodo-venta').innerHTML = opciones;
    $('select-metodo-devolucion').innerHTML = opciones;

  }catch (e) { 
    console.error('Error al cargar metodos de pago', e);
  }
}; 
// --- CRUD PRODUCTOS ---
let productoEditandoId = null;

const cargarProductosAdmin = async () => {
  try {
    // Traemos todos, incluyendo inactivos — para admin
    const res = await fetch(`${API}/venta/productos?todos=1`);
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
            <button class="btn-editar" onclick="abrirModalEditar(${p.id_producto}, '${p.nombre}', ${p.costo_produccion}, ${p.precio_venta}, ${p.id_tipo_producto})">
              Editar
            </button>
            <button class="btn-desactivar" onclick="confirmarDesactivar(${p.id_producto}, '${p.nombre}')">
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
    const res = await fetch(`${API}/venta/tipos-producto`);
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
  $('prod-nombre').value  = '';
  $('prod-costo').value   = '';
  $('prod-precio').value  = '';
  $('modal-producto').classList.remove('oculto');
};

const abrirModalEditar = (id, nombre, costo, precio, idTipo) => {
  productoEditandoId = id;
  $('modal-producto-titulo').textContent = 'Editar Producto';
  $('prod-nombre').value  = nombre;
  $('prod-costo').value   = costo;
  $('prod-precio').value  = precio;
  $('prod-tipo').value    = idTipo;
  $('modal-producto').classList.remove('oculto');
};

const confirmarDesactivar = async (id, nombre) => {
  if (!confirm(`¿Desactivar "${nombre}"? Ya no aparecerá en ventas.`)) return;
  try {
    const res = await fetch(`${API}/venta/productos/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    cargarProductosAdmin();
    cargarCatalogo(); // actualiza el selector de ventas también
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
  const nombre          = $('prod-nombre').value.trim();
  const costo_produccion = parseFloat($('prod-costo').value) || 0;
  const precio_venta    = parseFloat($('prod-precio').value);
  const id_tipo_producto = parseInt($('prod-tipo').value);

  if (!nombre) return mostrarError('error-producto', 'El nombre es requerido');
  if (!precio_venta || precio_venta <= 0) return mostrarError('error-producto', 'El precio debe ser mayor a cero');

  const url    = productoEditandoId 
    ? `${API}/venta/productos/${productoEditandoId}` 
    : `${API}/venta/productos`;
  const method = productoEditandoId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_tipo_producto, nombre, costo_produccion, precio_venta })
    });
    const data = await res.json();
    if (!res.ok) return mostrarError('error-producto', data.error);

    $('modal-producto').classList.add('oculto');
    cargarProductosAdmin();
    cargarCatalogo(); // refresca el selector en Nueva Venta
  } catch (e) {
    mostrarError('error-producto', 'Error al conectar con el servidor');
  }
});