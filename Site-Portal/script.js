// ===============================================
// PORTAL DE HORAS COMPLEMENTARES - CIESA
// Versão 3.0 - Com toggle de tema e localStorage
// ===============================================

// --- CONSTANTES E CONFIGURAÇÕES ---
const API_URL = "https://script.google.com/macros/s/AKfycbx3tyVS6Ljb_2V2W4170dfYAfl4QGEHopDu3Xh814hiJebWI16Ndo0-o5e5PNn8bpo5rQ/exec";
const TIMEOUT_MS = 10000; // 10 segundos
const META_HORAS = 140;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
const DEBOUNCE_DELAY = 300; // 300ms

// --- CACHE EM MEMÓRIA ---
const cache = new Map();

// --- ELEMENTOS DO DOM ---
const bodyEl = document.body; // NOVO
const themeToggleBtn = document.getElementById('theme-toggle'); // NOVO
const matriculaInput = document.getElementById('matricula');
const buscarBtn = document.getElementById('btn-buscar');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const resultsDiv = document.getElementById('results-area');

// ==========================================
// INICIALIZAÇÃO
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Portal de Horas Complementares carregado');
    console.log('🔗 API URL:', API_URL);
    
    // Carrega o tema salvo no localStorage
    carregarTemaSalvo();
    
    // Event listeners
    buscarBtn.addEventListener('click', handleBuscar);
    matriculaInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleBuscar();
    });
    
    // Event listener para o botão de toggle de tema
    themeToggleBtn.addEventListener('click', alternarTema);
    
    // Foco automático no input
    matriculaInput.focus();
});

// ==========================================
// TEMA ESCURO/CLARO
// ==========================================

/**
 * Carrega o tema salvo no localStorage
 */
function carregarTemaSalvo() {
    const temaSalvo = localStorage.getItem('tema');
    if (temaSalvo === 'escuro') {
        bodyEl.classList.add('tema-escuro');
        atualizarIconeTema(true);
    }
}

/**
 * Alterna entre tema claro e escuro
 */
function alternarTema() {
    const isEscuro = bodyEl.classList.toggle('tema-escuro');
    
    // Salva no localStorage
    localStorage.setItem('tema', isEscuro ? 'escuro' : 'claro');
    
    // Atualiza o ícone
    atualizarIconeTema(isEscuro);
    
    // Feedback visual
    themeToggleBtn.style.transform = 'rotate(360deg)';
    setTimeout(() => {
        themeToggleBtn.style.transform = 'rotate(0deg)';
    }, 300);
}

/**
 * Atualiza o ícone do botão de tema
 */
function atualizarIconeTema(isEscuro) {
    themeToggleBtn.textContent = isEscuro ? '☀️' : '🌙';
    themeToggleBtn.title = isEscuro ? 'Modo Claro' : 'Modo Escuro';
}

// ==========================================
// BUSCA DE DADOS
// ==========================================

/**
 * Handler principal para busca de dados
 */
async function handleBuscar() {
    const matricula = matriculaInput.value.trim();
    
    // Validação
    if (!matricula) {
        mostrarErro('Por favor, digite uma matrícula válida.');
        matriculaInput.focus();
        return;
    }
    
    if (matricula.length < 3) {
        mostrarErro('A matrícula deve ter pelo menos 3 caracteres.');
        return;
    }
    
    // Limpa estados anteriores
    limparEstados();
    
    // Mostra loading
    loadingDiv.style.display = 'flex';
    buscarBtn.disabled = true;
    
    try {
        const dados = await buscarDadosAluno(matricula);
        exibirResultados(dados);
    } catch (erro) {
        console.error('Erro ao buscar dados:', erro);
        mostrarErro(erro.message || 'Erro ao consultar dados. Tente novamente.');
    } finally {
        loadingDiv.style.display = 'none';
        buscarBtn.disabled = false;
    }
}

/**
 * Busca os dados do aluno na API
 */
async function buscarDadosAluno(matricula) {
    // Verifica cache
    const cached = cache.get(matricula);
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
        console.log('✅ Dados carregados do cache');
        return cached.data;
    }
    
    const url = `${API_URL}?matricula=${encodeURIComponent(matricula)}`;
    console.log('🔍 Buscando dados em:', url);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'Accept': 'application/json'
            }
        });
        
        clearTimeout(timeoutId);
        
        console.log('📡 Status da resposta:', response.status);
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('API não encontrada. Verifique a URL da implantação.');
            }
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
        }
        
        const resultado = await response.json();
        console.log('📦 Dados recebidos:', resultado);
        
        if (!resultado.sucesso) {
            throw new Error(resultado.erro || 'Matrícula não encontrada.');
        }
        
        // Armazena no cache
        cache.set(matricula, {
            data: resultado.dados,
            timestamp: Date.now()
        });
        
        return resultado.dados;
        
    } catch (erro) {
        clearTimeout(timeoutId);
        
        if (erro.name === 'AbortError') {
            throw new Error('Tempo limite excedido. Verifique sua conexão.');
        }
        
        throw erro;
    }
}

// ==========================================
// EXIBIÇÃO DE RESULTADOS
// ==========================================

/**
 * Exibe os resultados na tela
 */
function exibirResultados(dados) {
    const { nome, matricula, totalHoras, metaHoras, horasFaltantes, percentualConcluido, metaAtingida, categorias } = dados;
    
    // Animação de entrada
    resultsDiv.style.opacity = '0';
    resultsDiv.style.display = 'block';
    
    resultsDiv.innerHTML = `
        <div class="resultado-card">
            <div class="aluno-info">
                <h2>👤 ${nome}</h2>
                <p class="matricula-display">Matrícula: <strong>${matricula}</strong></p>
            </div>
            
            <div class="horas-resumo">
                <div class="horas-box ${metaAtingida ? 'meta-atingida' : ''}">
                    <div class="horas-numero">${totalHoras}</div>
                    <div class="horas-label">Horas Computadas</div>
                </div>
                
                <div class="horas-box horas-meta">
                    <div class="horas-numero">${metaHoras}</div>
                    <div class="horas-label">Meta Total</div>
                </div>
                
                ${!metaAtingida ? `
                <div class="horas-box horas-faltantes">
                    <div class="horas-numero">${horasFaltantes}</div>
                    <div class="horas-label">Horas Restantes</div>
                </div>
                ` : ''}
            </div>
            
            <div class="progresso-container">
                <div class="progresso-header">
                    <span>Progresso</span>
                    <span class="progresso-percentual">${percentualConcluido}%</span>
                </div>
                <div class="progresso-barra">
                    <div class="progresso-preenchimento ${metaAtingida ? 'completo' : ''}" 
                         style="width: ${Math.min(percentualConcluido, 100)}%">
                    </div>
                </div>
                ${metaAtingida ? `
                    <div class="badge-sucesso">
                        🎉 Parabéns! Meta atingida!
                    </div>
                ` : ''}
            </div>
            
            ${categorias && categorias.length > 0 ? `
                <div class="categorias-container">
                    <h3>📚 Detalhamento por Categoria</h3>
                    <div class="categorias-lista">
                        ${categorias.map(cat => `
                            <div class="categoria-item">
                                <div class="categoria-nome">${cat.nome}</div>
                                <div class="categoria-horas">${cat.horas}h</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    // Animação de fade in
    setTimeout(() => {
        resultsDiv.style.opacity = '1';
    }, 10);
}

// ==========================================
// ESTADOS E FEEDBACK
// ==========================================

/**
 * Mostra mensagem de erro
 */
function mostrarErro(mensagem) {
    errorDiv.textContent = mensagem;
    errorDiv.style.display = 'block';
    resultsDiv.style.display = 'none';
    
    // Auto-hide após 5 segundos
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

/**
 * Limpa todos os estados visuais
 */
function limparEstados() {
    errorDiv.style.display = 'none';
    resultsDiv.style.display = 'none';
    loadingDiv.style.display = 'none';
}

// ==========================================
// UTILITÁRIOS
// ==========================================

/**
 * Limpa o cache (útil para debug)
 */
function limparCache() {
    cache.clear();
    console.log('🗑️ Cache limpo');
}

// Expõe funções úteis para debug
window.portalDebug = {
    limparCache,
    verCache: () => console.log(cache),
    verAPI: () => console.log('API URL:', API_URL)
};

console.log('💡 Digite portalDebug no console para ver funções de debug');
