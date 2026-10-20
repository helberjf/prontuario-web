/**
 * Modo de demonstração: API com banco EM MEMÓRIA (nada vai para o Neon, tudo some ao reiniciar).
 * Login: demo@example.com / demo-demo-demo. Use só para conhecer o sistema.
 */
import { criarApp } from './app.js';
import { criarBancoMemoria, usuarioDemo } from './banco-memoria.js';

const db = criarBancoMemoria([usuarioDemo('demo@example.com', 'Demonstração', 'demo-demo-demo')]);
const app = criarApp({ db, segredo: 'demo-demo-demo-demo-demo-demo-demo-demo-1234567890' });
app.listen(3001, () => console.log('API DE DEMONSTRAÇÃO (banco em memória) em http://localhost:3001\nLogin: demo@example.com / demo-demo-demo'));
