// ============================================
// PORTAL DE HORAS COMPLEMENTARES - CIESA
// Versão melhorada com validações e cache
// ============================================

// --- CONSTANTES E CONFIGURAÇÕES ---
const API_URL = "https://script.google.com/macros/s/AKfycbxf2Ku_PGhVFUwCq5tSAP9GFIy8-FAiQ7azmhNugwJDUtERJ9D3pheGfEAvc1FZ5ilZMA/exec";
const TIMEOUT_MS = 10000; // 10 segundos
const META_HORAS = 140;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
const DEBOUNCE_DELAY = 300; // 300ms

// --- CACHE EM MEMÓRIA ---
const cache = new Map();

// --- ELEMENTOS DO DOM ---
const matriculaInput = document.getElementById('matricula');
const buscarBtn = document.getElementById('btn-buscar');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const resultsDiv = document.getElementById('results-area');
const totalHorasH2 = document.getElementById('total-horas');
const statusAlunoP = document.getElementById('status-aluno');
const horasFaltantesP = document.getElementById('horas-faltantes');
const categoryListUl = document.getElementById('category-list');
const progressBarFill = document.getElementById('progress-bar-fill');

// --- VARIÁVEIS DE CONTROLE ---
let searchTimeout;
let currentAbortController = null;

// ============================================
// INICIALIZAÇÃO
// ============================================

// Restaura última matrícula salva
try {
    const lastMatricula = localStorage.getItem('lastMatricula');
    if (lastMatricula) {
        matriculaInput.value = lastMatricula;
    }
} catch (e) {
    console.warn('localStorage não disponível:', e);
}

// ============================================
// EVENT LISTENERS
// ============================================

buscarBtn.addEventListener('click', () => debouncedSearch());

matriculaInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        debouncedSearch();
    }
});

// Limpa entrada ao colar (remove espaços e caracteres inválidos)
matriculaInput.addEventListener('paste', (ev) => {
    ev.preventDefault();
    const text = (ev.clipboardData || window.clipboardData)
        .getData('text')
        .trim()
        .replace(/\D/g, ''); // Remove não-numéricos
    matriculaInput.value = text;
});

// Limpa erro quando usuário começa a digitar
matriculaInput.addEventListener('input', () => {
    if (errorDiv.style.display === 'block') {
        setUIState('idle');
    }
});

// ============================================
// FUNÇÕES DE VALIDAÇÃO
// ============================================

/**
 * Valida e limpa a matrícula
 * @param {string} matricula - Matrícula a ser validada
 * @returns {object} Objeto com validação e valor limpo
 */
function validarMatricula(matricula) {
    const cleaned = matricula.replace(/\D/g, ''); // Remove não-numéricos
    
    if (cleaned.length === 0) {
        return { 
            valid: false, 
            error: "Por favor, digite sua matrícula." 
        };
    }
    
    if (cleaned.length < 4) {
        return { 
            valid: false, 
            error: "Matrícula muito curta. Digite pelo menos 4 dígitos." 
        };
    }
    
    if (cleaned.length > 20) {
        return { 
            valid: false, 
            error: "Matrícula muito longa. Máximo de 20 dígitos." 
        };
    }
    
    return { 
        valid: true, 
        value: cleaned 
    };
}

/**
 * Sanitiza texto para prevenir XSS
 * @param {string} text - Texto a ser sanitizado
 * @returns {string} Texto seguro
 */
function sanitizeText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// GERENCIAMENTO DE ESTADO DA UI
// ============================================

/**
 * Gerencia o estado da interface (UI)
 * @param {'idle' | 'loading' | 'success' | 'error'} state - O estado desejado
 */
function setUIState(state) {
    // Reseta todos os estados
    loadingDiv.style.display = 'none';
    loadingDiv.setAttribute('aria-busy', 'false');
    errorDiv.style.display = 'none';
    resultsDiv.style.display = 'none';
    
    buscarBtn.disabled = false;
    buscarBtn.textContent = 'Buscar';

    // Aplica o estado específico
    switch (state) {
        case 'loading':
            buscarBtn.disabled = true;
            buscarBtn.textContent = 'Buscando...';
            loadingDiv.style.display = 'block';
            loadingDiv.setAttribute('aria-busy', 'true');
            break;
            
        case 'success':
            resultsDiv.style.display = 'block';
            break;
            
        case 'error':
            errorDiv.style.display = 'block';
            errorDiv.setAttribute('role', 'alert');
            break;
            
        case 'idle':
        default:
            // Estado inicial, tudo escondido
            break;
    }
}

// ============================================
// DEBOUNCE E BUSCA
// ============================================

/**
 * Debounce para evitar múltiplas requisições
 */
function debouncedSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => buscarDados(), DEBOUNCE_DELAY);
}

/**
 * Busca dados da API com cache e validação
 */
async function buscarDados() {
    const matricula = matriculaInput.value.trim();
    
    // Validação
    const validation = validarMatricula(matricula);
    if (!validation.valid) {
        showError(validation.error);
        matriculaInput.focus();
        return;
    }
    
    const matriculaLimpa = validation.value;
    
    // Salva no localStorage
    try {
        localStorage.setItem('lastMatricula', matriculaLimpa);
    } catch (e) {
        console.warn('Erro ao salvar no localStorage:', e);
    }
    
    // Verifica cache
    const cached = cache.get(matriculaLimpa);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        console.log('Usando dados do cache');
        showData(cached.data);
        setUIState('success');
        return;
    }
    
    // Cancela requisição anterior se houver
    if (currentAbortController) {
        currentAbortController.abort();
    }
    
    setUIState('loading');
    
    currentAbortController = new AbortController();
    const timeoutId = setTimeout(() => currentAbortController.abort(), TIMEOUT_MS);

    try {
        const url = `${API_URL}?matricula=${encodeURIComponent(matriculaLimpa)}`;
        const response = await fetch(url, { 
            cache: 'no-store', 
            signal: currentAbortController.signal 
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data && data.error) {
            throw new Error(data.message || 'Erro retornado pela API.');
        }
        
        // Sucesso - salva no cache
        const dataToShow = data || { 
            totalGeral: 0, 
            categorias: [], 
            status: 'Desconhecido' 
        };
        
        cache.set(matriculaLimpa, {
            data: dataToShow,
            timestamp: Date.now()
        });
        
        showData(dataToShow);
        setUIState('success');
        
    } catch (err) {
        clearTimeout(timeoutId);
        handleError(err);
    } finally {
        currentAbortController = null;
    }
}

// ============================================
// TRATAMENTO DE ERROS
// ============================================

/**
 * Trata erros de forma amigável
 * @param {Error} err - Erro capturado
 */
function handleError(err) {
    let errorMsg = err.message || String(err);
    
    // Mapeamento de erros para mensagens amigáveis
    const errorMap = {
        'AbortError': 'A requisição excedeu o tempo limite. Tente novamente.',
        'Failed to fetch': 'Sem conexão com a internet. Verifique sua conexão.',
        'NetworkError': 'Erro de rede. Tente novamente em alguns instantes.',
        'HTTP 404': 'Matrícula não encontrada no sistema.',
        'HTTP 500': 'Erro no servidor. Tente novamente mais tarde.',
        'HTTP 503': 'Serviço temporariamente indisponível. Aguarde alguns minutos.',
    };
    
    // Verifica se o erro corresponde a algum mapeamento
    for (const [key, value] of Object.entries(errorMap)) {
        if (err.name === key || errorMsg.includes(key)) {
            errorMsg = value;
            break;
        }
    }
    
    showError(errorMsg);
}

/**
 * Exibe mensagem de erro na interface
 * @param {string} errorMsg - Mensagem de erro
 */
function showError(errorMsg) {
    const msg = errorMsg ? 
        String(errorMsg).replace("Exception: ", "") : 
        "Erro desconhecido. Tente novamente.";
    
    errorDiv.textContent = "❌ " + msg;
    setUIState('error');
    
    // Foca no campo de entrada para acessibilidade
    setTimeout(() => matriculaInput.focus(), 100);
}

// ============================================
// EXIBIÇÃO DE DADOS
// ============================================

/**
 * Exibe os dados formatados na tela
 * @param {object} data - Os dados recebidos da API
 */
function showData(data) {
    const total = Number(data?.totalGeral) || 0;
    
    // Atualiza total de horas
    totalHorasH2.textContent = `${total} horas`;
    
    // Atualiza status (sanitizado)
    const statusTexto = sanitizeText(data?.status || "Desconhecido");
    statusAlunoP.textContent = `Status: ${statusTexto}`;
    
    // Calcula progresso
    const percentage = (total / META_HORAS) * 100;
    const displayPercentage = Math.min(percentage, 100);
    const roundedPercentage = Math.round(percentage);
    
    // Atualiza barra de progresso
    progressBarFill.style.width = `${displayPercentage}%`;
    progressBarFill.setAttribute('aria-valuemin', '0');
    progressBarFill.setAttribute('aria-valuemax', String(META_HORAS));
    progressBarFill.setAttribute('aria-valuenow', String(Math.max(0, Math.min(total, META_HORAS))));
    progressBarFill.setAttribute('aria-label', `Progresso: ${roundedPercentage} por cento`);
    
    // Mostra percentual na barra se couber
    progressBarFill.textContent = displayPercentage > 10 ? `${roundedPercentage}%` : '';
    
    // Feedback de conclusão
    if (total >= META_HORAS) {
        horasFaltantesP.textContent = "🎉 Parabéns, você atingiu a meta!";
        totalHorasH2.style.color = "var(--cor-sucesso)";
        progressBarFill.classList.add('complete');
    } else {
        const faltantes = META_HORAS - total;
        horasFaltantesP.textContent = `Faltam ${faltantes} horas para a meta de ${META_HORAS}.`;
        totalHorasH2.style.color = "var(--cor-primaria)";
        progressBarFill.classList.remove('complete');
    }
    
    // Renderiza categorias
    renderCategorias(data?.categorias || []);
    
    // Foca na área de resultados para acessibilidade
    setTimeout(() => {
        resultsDiv.focus();
        resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

/**
 * Renderiza a lista de categorias
 * @param {Array} categorias - Array de categorias
 */
function renderCategorias(categorias) {
    categoryListUl.innerHTML = "";
    
    if (!Array.isArray(categorias) || categorias.length === 0) {
        const li = document.createElement('li');
        li.className = 'empty-state';
        li.textContent = "Nenhuma hora computada ainda.";
        categoryListUl.appendChild(li);
        return;
    }
    
    categorias.forEach((cat) => {
        const li = document.createElement('li');
        const nome = sanitizeText(cat?.nome || 'Categoria');
        const horas = Number(cat?.horas) || 0;
        
        const nomeDiv = document.createElement('div');
        nomeDiv.className = 'category-name';
        nomeDiv.textContent = nome;
        
        const spanHoras = document.createElement('span');
        spanHoras.className = 'category-hours';
        spanHoras.textContent = `${horas} horas`;
        
        li.appendChild(nomeDiv);
        li.appendChild(spanHoras);
        categoryListUl.appendChild(li);
    });
}

// ============================================
// LOG DE DEBUG (remover em produção)
// ============================================

console.log('Portal de Horas CIESA carregado ✓');
console.log('Versão: 2.0 - Melhorada com validações e cache');
