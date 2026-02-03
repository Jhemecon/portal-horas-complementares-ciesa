// --- CONSTANTES E URL ---
const API_URL = "https://script.google.com/macros/s/AKfycbyTBczCl5M4o_tpFtdU_hO_e81qe-hFgYmudYKvELBdlSok-EvzwjcUvNwf68ixHzSb/exec";
const TIMEOUT_MS = 10000; // 10s
const META_HORAS = 140;

// --- MAPEAMENTO DOS ELEMENTOS (DOM) ---
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

// --- ESTADO INICIAL E EVENTOS ---

// Preenche com a última matrícula salva
try {
    const last = localStorage.getItem('lastMatricula');
    if (last) matriculaInput.value = last;
} catch (e) { /* ignorar erros de localStorage */ }

// Ouvintes de eventos
buscarBtn.addEventListener('click', buscarDados);
matriculaInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); 
        buscarDados();
    }
});

// Manipulador de "colar" modernizado
matriculaInput.addEventListener('paste', (ev) => {
    ev.preventDefault();
    const text = (ev.clipboardData || window.clipboardData).getData('text').trim();
    matriculaInput.value = text;
});

// --- LÓGICA DA APLICAÇÃO ---

/**
 * Gerencia o estado da interface (UI)
 * @param {'idle' | 'loading' | 'success' | 'error'} state O estado desejado
 */
function setUIState(state) {
    // Reseta todos os estados
    loadingDiv.style.display = 'none';
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
            break;
        case 'success':
            resultsDiv.style.display = 'block';
            break;
        case 'error':
            errorDiv.style.display = 'block';
            break;
        case 'idle':
        default:
            // Estado inicial, tudo escondido
            break;
    }
}

/**
 * Busca os dados da API e controla o fluxo
 */
async function buscarDados() {
    const matricula = matriculaInput.value.trim();
    if (!matricula) {
        showError("Por favor, digite sua matrícula.");
        matriculaInput.focus();
        return;
    }

    try { 
        localStorage.setItem('lastMatricula', matricula); 
    } catch(e) { /* ignorar erros */ }

    setUIState('loading');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const url = `${API_URL}?matricula=${encodeURIComponent(matricula)}`;
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        
        clearTimeout(timeoutId); // Limpa o timeout se a resposta chegou
        
        if (!response.ok) { 
            throw new Error(`Erro de rede: ${response.status} ${response.statusText}`); 
        }
        
        const data = await response.json();
        
        if (data && data.error) { 
            throw new Error(data.message || 'Erro retornado pela API.'); 
        }
        
        // Sucesso
        showData(data || { totalGeral: 0, categorias: [], status: 'Desconhecido' });
        setUIState('success');
        
    } catch (err) {
        // Tratamento de erros
        clearTimeout(timeoutId); // Limpa o timeout em caso de erro também
        let errorMsg = err.message || String(err);
        
        if (err && err.name === 'AbortError') {
            errorMsg = 'A requisição excedeu o tempo limite. Tente novamente.';
        }
        
        showError(errorMsg);
    }
}

/**
 * Exibe os dados formatados na tela
 * @param {object} data Os dados recebidos da API
 */
function showData(data) {
    const total = Number(data && data.totalGeral) || 0;
    totalHorasH2.textContent = total + " horas";
    statusAlunoP.textContent = "Status: " + (data && data.status ? data.status : "Desconhecido");
    
    const percentage = (total / META_HORAS) * 100;
    const displayPercentage = Math.min(percentage, 100);
    const roundedPercentage = Math.round(percentage);

    progressBarFill.style.width = displayPercentage + '%';
    
    // Atualiza atributos ARIA
    progressBarFill.setAttribute('aria-valuemin', '0');
    progressBarFill.setAttribute('aria-valuemax', String(META_HORAS));
    progressBarFill.setAttribute('aria-valuenow', String(Math.max(0, Math.min(total, META_HORAS))));
    progressBarFill.setAttribute('aria-label', `Progresso: ${roundedPercentage} por cento`);

    // Mostra texto na barra se couber
    progressBarFill.textContent = displayPercentage > 10 ? roundedPercentage + '%' : '';
    
    // Feedback de conclusão
    if (total >= META_HORAS) {
        horasFaltantesP.textContent = "Parabéns, você atingiu a meta!";
        totalHorasH2.style.color = "var(--cor-sucesso)"; // Usa variável CSS
        progressBarFill.classList.add('complete'); 
    } else {
        let faltantes = META_HORAS - total;
        horasFaltantesP.textContent = "Faltam " + faltantes + " horas para a meta.";
        totalHorasH2.style.color = "var(--cor-primaria)"; // Usa variável CSS
        progressBarFill.classList.remove('complete'); 
    }
    
    // Preenche a lista de categorias
    categoryListUl.innerHTML = ""; 
    const categorias = Array.isArray(data && data.categorias) ? data.categorias : [];
    
    if (categorias.length === 0) {
        const li = document.createElement('li');
        li.textContent = "Nenhuma hora computada ainda.";
        categoryListUl.appendChild(li);
    } else {
        categorias.forEach(function(cat) {
            const li = document.createElement('li');
            const nome = cat && cat.nome ? cat.nome : 'Categoria';
            const horas = Number(cat && cat.horas) || 0;
            
            const nomeDiv = document.createElement('div');
            nomeDiv.textContent = nome;
            const spanHoras = document.createElement('span');
            spanHoras.textContent = horas + " horas";
            
            li.appendChild(nomeDiv);
            li.appendChild(spanHoras); 
            categoryListUl.appendChild(li);
        });
    }
    
    // Foca na área de resultados para acessibilidade
    setTimeout(() => resultsDiv.focus(), 50);
}

/**
 * Exibe uma mensagem de erro
 * @param {string} errorMsg A mensagem de erro
 */
function showError(errorMsg) {
    const msg = errorMsg ? String(errorMsg).replace("Exception: ", "") : "Não foi possível conectar à API.";
    errorDiv.textContent = "Erro: " + msg;
    setUIState('error');
}
