let lastQuery = null;
let lastType = 'auto';
let currentDocumento = null;
let currentIdCiclo = null;

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 });

function $(id) { return document.getElementById(id); }
function safe(value) { return value === null || value === undefined || value === '' ? '-' : value; }
function decimal(value) { return value === null || value === undefined || value === '' ? 0 : Number(value); }

function showStatus(element, message, type = '') {
    element.className = 'status ' + type;
    element.textContent = message;
    element.classList.remove('hidden');
}

async function parseResponse(response) {
    const text = await response.text();
    try { return JSON.parse(text); } catch { return { detail: text || response.statusText }; }
}

$('uploadForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = $('fileInput').files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    showStatus($('uploadStatus'), 'Procesando archivo. No cierres esta pestaña...', 'warn');

    try {
        const response = await fetch('/api/imports/upload', { method: 'POST', body: formData });
        const data = await parseResponse(response);
        if (!response.ok) throw new Error(data.detail || 'Error cargando archivo');

        showStatus(
            $('uploadStatus'),
            `Carga ${data.estado}\nBatch: ${data.id}\nFilas archivo: ${data.total_filas}\nInsertadas: ${data.filas_insertadas}\nRechazadas: ${data.filas_rechazadas}`,
            data.filas_rechazadas > 0 ? 'warn' : 'ok'
        );
        loadImports();
    } catch (err) {
        showStatus($('uploadStatus'), err.message, 'error');
    }
});

$('searchBtn').addEventListener('click', searchRecords);
$('searchInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') searchRecords();
});
$('reloadSearch').addEventListener('click', () => {
    if (lastQuery) searchRecords();
});

async function searchRecords() {
    const query = $('searchInput').value.trim();
    const tipo = $('searchType').value;
    if (!query) {
        showStatus($('searchStatus'), 'Escribe una cédula o un ID Ciclo.', 'error');
        return;
    }

    lastQuery = query;
    lastType = tipo;
    showStatus($('searchStatus'), 'Buscando...', 'warn');

    try {
        const response = await fetch(`/api/registros?query=${encodeURIComponent(query)}&tipo=${encodeURIComponent(tipo)}`);
        const data = await parseResponse(response);
        if (!response.ok) throw new Error(data.detail || 'Error consultando registros');

        renderResults(data);
        showStatus($('searchStatus'), `Consulta finalizada. Registros encontrados: ${data.total}`, data.total ? 'ok' : 'warn');
    } catch (err) {
        showStatus($('searchStatus'), err.message, 'error');
    }
}

function renderResults(data) {
    $('emptyState').classList.add('hidden');
    $('resultsArea').classList.remove('hidden');

    const p = data.paciente || {};
    currentDocumento = p.identificacion_paciente || null;
    currentIdCiclo = data.registros?.[0]?.id_ciclo_dispensacion || null;

    $('pDocumento').textContent = safe(p.identificacion_paciente);
    $('pTipoDoc').textContent = safe(p.tipo_doc_paciente);
    $('pNombre').textContent = safe(p.nombre);
    $('pEps').textContent = safe(p.eps);
    $('pMunicipio').textContent = safe(p.municipio);
    $('pDepartamento').textContent = safe(p.departamento);
    $('pCategoria').textContent = safe(p.categoria_actual);
    $('pTotal').textContent = data.total;
    $('categorySelect').value = p.categoria_actual || '';

    $('tRegistros').textContent = data.total;
    $('tValor').textContent = money.format(decimal(data.total_valor_direccionado));
    $('tCopago').textContent = money.format(decimal(data.total_copago));

    const rows = data.registros.map(r => `
        <tr>
          <td><span class="pill">${safe(r.id_ciclo_dispensacion)}</span></td>
          <td>${safe(r.numero_prescripcion)}</td>
          <td>${safe(r.fecha_maxima_entrega)}</td>
          <td>${safe(r.fecha_direccionamiento)}</td>
          <td>${safe(r.codigo_tecnologia_direccionada)}</td>
          <td>${safe(r.tecnologia_direccionada)}</td>
          <td>${safe(r.cantidad_total_entregar)}</td>
          <td>${safe(r.estado_paciente)}</td>
          <td>${safe(r.estado_final)}</td>
          <td>${safe(r.laboratorio)}</td>
          <td>${money.format(decimal(r.valor_direccionado))}</td>
          <td>${safe(r.categoria)}</td>
          <td>${money.format(decimal(r.copago))}</td>
        </tr>
      `).join('');

    $('recordsBody').innerHTML = rows || '<tr><td colspan="13">Sin registros.</td></tr>';
}

$('saveCategory').addEventListener('click', async () => {
    const categoria = $('categorySelect').value;
    if (!categoria) {
        showStatus($('searchStatus'), 'Selecciona una categoría.', 'error');
        return;
    }

    const payload = { categoria };
    if (currentDocumento) payload.identificacion_paciente = currentDocumento;
    else if (currentIdCiclo) payload.id_ciclo_dispensacion = currentIdCiclo;
    else {
        showStatus($('searchStatus'), 'No hay paciente o registro seleccionado.', 'error');
        return;
    }

    try {
        const response = await fetch('/api/registros/categoria', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await parseResponse(response);
        if (!response.ok) throw new Error(data.detail || 'Error actualizando categoría');

        showStatus($('searchStatus'), `Categoría guardada. Registros actualizados: ${data.actualizados}. Porcentaje: ${data.porcentaje}%`, 'ok');
        if (lastQuery) searchRecords();
    } catch (err) {
        showStatus($('searchStatus'), err.message, 'error');
    }
});

$('refreshImports').addEventListener('click', loadImports);

async function loadImports() {
    try {
        const response = await fetch('/api/imports');
        const data = await parseResponse(response);
        if (!response.ok) throw new Error(data.detail || 'Error cargando historial');

        if (!data.length) {
            $('importsList').textContent = 'No hay cargas registradas.';
            return;
        }

        $('importsList').innerHTML = data.slice(0, 8).map(item =>
            `#${item.id} · ${item.estado}\n${item.filename}\nInsertadas: ${item.filas_insertadas} · Rechazadas: ${item.filas_rechazadas}\n${new Date(item.created_at).toLocaleString('es-CO')}`
        ).join('\n\n');
    } catch (err) {
        showStatus($('importsList'), err.message, 'error');
    }
}

loadImports();