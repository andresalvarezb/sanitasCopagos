const $ = (id) => document.getElementById(id);

const elements = {
    uploadForm: $('uploadForm'),
    fileInput: $('fileInput'),
    uploadStatus: $('uploadStatus'),
    refreshImports: $('refreshImports'),
    importsList: $('importsList'),
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

const formatDate = (value) => {
    if (!value) return '-';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString('es-CO', {
        dateStyle: 'short',
        timeStyle: 'short',
    });
};

const renderImports = (imports = []) => {
    if (!elements.importsList) return;

    elements.importsList.className = 'status';

    if (!imports.length) {
        elements.importsList.textContent = 'No hay cargas registradas.';
        return;
    }

    elements.importsList.innerHTML = imports
        .slice(0, 20)
        .map(
            ({
                id,
                estado,
                filename,
                total_filas,
                filas_insertadas,
                filas_rechazadas,
                created_at,
                error,
            }) => `
        <div class="import-item">
          <span class="badge">#${id} · ${estado}</span>
          <strong>${filename ?? 'Archivo sin nombre'}</strong>
          <span>Filas archivo: ${total_filas ?? 0}</span>
          <span>Insertadas: ${filas_insertadas ?? 0}</span>
          <span>Rechazadas: ${filas_rechazadas ?? 0}</span>
          <span>Fecha carga: ${formatDate(created_at)}</span>
          ${error ? `<span>Error: ${error}</span>` : ''}
        </div>
      `
        )
        .join('');
};

const loadImports = async () => {
    try {
        const imports = await requestJson('/api/imports');
        renderImports(imports);
    } catch (error) {
        showStatus(
            elements.importsList,
            error?.message ?? 'Error cargando historial',
            'error'
        );
    }
};

const handleUploadSubmit = async (event) => {
    event.preventDefault();

    const file = elements.fileInput?.files?.[0];

    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    showStatus(
        elements.uploadStatus,
        'Procesando archivo. No cierres esta pestaña...',
        'warn'
    );

    try {
        const data = await requestJson('/api/imports/upload', {
            method: 'POST',
            body: formData,
        });

        showStatus(
            elements.uploadStatus,
            [
                `Carga ${data.estado}`,
                `Batch: ${data.id}`,
                `Filas archivo: ${data.total_filas}`,
                `Insertadas: ${data.filas_insertadas}`,
                `Rechazadas: ${data.filas_rechazadas}`,
            ].join('\n'),
            data.filas_rechazadas > 0 ? 'warn' : 'ok'
        );

        elements.fileInput.value = '';

        await loadImports();
    } catch (error) {
        showStatus(
            elements.uploadStatus,
            error?.message ?? 'Error cargando archivo',
            'error'
        );
    }
};

elements.uploadForm?.addEventListener('submit', handleUploadSubmit);
elements.refreshImports?.addEventListener('click', loadImports);

await loadImports();