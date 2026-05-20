const $ = (id) => document.getElementById(id);

const state = {
  lastQuery: null,
  currentDocumento: null,
  currentIdCiclo: null,
};

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 2,
});

const elements = {
  searchBtn: $('searchBtn'),
  searchInput: $('searchInput'),
  searchType: $('searchType'),
  searchStatus: $('searchStatus'),
  reloadSearch: $('reloadSearch'),
  emptyState: $('emptyState'),
  resultsArea: $('resultsArea'),
  pDocumento: $('pDocumento'),
  pTipoDoc: $('pTipoDoc'),
  pNombre: $('pNombre'),
  pEps: $('pEps'),
  pMunicipio: $('pMunicipio'),
  pDepartamento: $('pDepartamento'),
  pCategoria: $('pCategoria'),
  pTotal: $('pTotal'),
  categorySelect: $('categorySelect'),
  saveCategory: $('saveCategory'),
  tRegistros: $('tRegistros'),
  tValor: $('tValor'),
  tCopago: $('tCopago'),
  recordsBody: $('recordsBody'),
};

const safe = (value) => {
  const normalizedValue = value ?? '';
  return normalizedValue === '' ? '-' : normalizedValue;
};

const toNumber = (value) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

const formatMoney = (value) => moneyFormatter.format(toNumber(value));

const escapeHtml = (value) => {
  const text = String(safe(value));

  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
};

const showStatus = (element, message, type = '') => {
  if (!element) return;

  element.className = `status ${type}`.trim();
  element.textContent = message;
  element.classList.remove('hidden');
};

const parseResponse = async (response) => {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      detail: text || response.statusText || 'Respuesta inválida del servidor',
    };
  }
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const data = await parseResponse(response);

  if (!response.ok) {
    throw new Error(data?.detail ?? 'Error inesperado del servidor');
  }

  return data;
};

const buildSearchUrl = ({ query, tipo }) => {
  const params = new URLSearchParams({
    query,
    tipo,
  });

  return `/api/registros?${params.toString()}`;
};

const setText = (element, value) => {
  if (!element) return;
  element.textContent = safe(value);
};

const renderPatientInfo = ({ paciente = {}, total = 0 }) => {
  state.currentDocumento = paciente.identificacion_paciente ?? null;

  setText(elements.pDocumento, paciente.identificacion_paciente);
  setText(elements.pTipoDoc, paciente.tipo_doc_paciente);
  setText(elements.pNombre, paciente.nombre);
  setText(elements.pEps, paciente.eps);
  setText(elements.pMunicipio, paciente.municipio);
  setText(elements.pDepartamento, paciente.departamento);
  setText(elements.pCategoria, paciente.categoria_actual);
  setText(elements.pTotal, total);

  if (elements.categorySelect) {
    elements.categorySelect.value = paciente.categoria_actual ?? '';
  }
};

const renderTotals = ({
  total = 0,
  total_valor_direccionado = 0,
  total_copago = 0,
}) => {
  setText(elements.tRegistros, total);
  setText(elements.tValor, formatMoney(total_valor_direccionado));
  setText(elements.tCopago, formatMoney(total_copago));
};

const renderRecords = (records = []) => {
  if (!elements.recordsBody) return;

  if (!records.length) {
    elements.recordsBody.innerHTML = '<tr><td colspan="13">Sin registros.</td></tr>';
    return;
  }

  elements.recordsBody.innerHTML = records
    .map(
      (record) => `
        <tr>
          <td>
            <span class="pill">
              ${escapeHtml(record.id_ciclo_dispensacion)}
            </span>
          </td>
          <td>${escapeHtml(record.numero_prescripcion)}</td>
          <td>${escapeHtml(record.fecha_maxima_entrega)}</td>
          <td>${escapeHtml(record.fecha_direccionamiento)}</td>
          <td>${escapeHtml(record.codigo_tecnologia_direccionada)}</td>
          <td>${escapeHtml(record.tecnologia_direccionada)}</td>
          <td>${escapeHtml(record.cantidad_total_entregar)}</td>
          <td>${escapeHtml(record.estado_paciente)}</td>
          <td>${escapeHtml(record.estado_final)}</td>
          <td>${escapeHtml(record.laboratorio)}</td>
          <td>${escapeHtml(formatMoney(record.valor_direccionado))}</td>
          <td>${escapeHtml(record.categoria)}</td>
          <td>${escapeHtml(formatMoney(record.copago))}</td>
        </tr>
      `
    )
    .join('');
};

const renderResults = (data = {}) => {
  elements.emptyState?.classList.add('hidden');
  elements.resultsArea?.classList.remove('hidden');

  const records = data.registros ?? [];

  state.currentIdCiclo = records.at(0)?.id_ciclo_dispensacion ?? null;

  renderPatientInfo(data);
  renderTotals(data);
  renderRecords(records);
};

const searchRecords = async () => {
  const query = elements.searchInput?.value?.trim() ?? '';
  const tipo = elements.searchType?.value ?? 'auto';

  if (!query) {
    showStatus(
      elements.searchStatus,
      'Escribe una cédula o un ID Ciclo.',
      'error'
    );
    return;
  }

  state.lastQuery = query;

  showStatus(elements.searchStatus, 'Buscando...', 'warn');

  try {
    const data = await requestJson(buildSearchUrl({ query, tipo }));

    renderResults(data);

    showStatus(
      elements.searchStatus,
      `Consulta finalizada. Registros encontrados: ${data.total ?? 0}`,
      data.total ? 'ok' : 'warn'
    );
  } catch (error) {
    showStatus(
      elements.searchStatus,
      error?.message ?? 'Error consultando registros',
      'error'
    );
  }
};

const buildCategoryPayload = () => {
  const categoria = elements.categorySelect?.value ?? '';

  if (!categoria) {
    throw new Error('Selecciona una categoría.');
  }

  if (state.currentDocumento) {
    return {
      categoria,
      identificacion_paciente: state.currentDocumento,
    };
  }

  if (state.currentIdCiclo) {
    return {
      categoria,
      id_ciclo_dispensacion: state.currentIdCiclo,
    };
  }

  throw new Error('No hay paciente o registro seleccionado.');
};

const saveCategory = async () => {
  let payload;

  try {
    payload = buildCategoryPayload();
  } catch (error) {
    showStatus(elements.searchStatus, error.message, 'error');
    return;
  }

  try {
    const data = await requestJson('/api/registros/categoria', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    showStatus(
      elements.searchStatus,
      `Categoría guardada. Registros actualizados: ${data.actualizados ?? 0}. Porcentaje: ${data.porcentaje ?? 0}%`,
      'ok'
    );

    if (state.lastQuery) {
      await searchRecords();
    }
  } catch (error) {
    showStatus(
      elements.searchStatus,
      error?.message ?? 'Error actualizando categoría',
      'error'
    );
  }
};

elements.searchBtn?.addEventListener('click', searchRecords);

elements.searchInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    searchRecords();
  }
});

elements.reloadSearch?.addEventListener('click', () => {
  if (state.lastQuery) {
    searchRecords();
  }
});

elements.saveCategory?.addEventListener('click', saveCategory);