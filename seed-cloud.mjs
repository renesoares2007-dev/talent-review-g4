const BASE = 'https://performance-evaluation-eight.vercel.app/api';

async function seed() {
  console.log('Seeding cloud database via API...');
  console.log('Base URL:', BASE);

  // 1. Criar Valores
  const valores = [
    { name: 'Liberdade com responsabilidade', description: 'Autonomia para agir com responsabilidade pelos resultados', behaviors: [{ description: 'Toma decisoes de forma autonoma e assume as consequencias' }, { description: 'Gerencia seu tempo e prioridades sem necessidade de microgerenciamento' }] },
    { name: 'Alta performance como padrao', description: 'Buscar excelencia em tudo que faz', behaviors: [{ description: 'Entrega resultados consistentemente acima da media' }, { description: 'Busca constantemente elevar o padrao de qualidade do trabalho' }] },
    { name: 'Verdade acima de tudo', description: 'Transparencia e honestidade nas relacoes', behaviors: [{ description: 'Comunica feedbacks de forma direta e honesta' }, { description: 'Reconhece erros e compartilha aprendizados abertamente' }] },
    { name: 'Meritocracia real', description: 'Reconhecimento baseado em resultados e contribuicoes', behaviors: [{ description: 'Reconhece e valoriza entregas e contribuicoes dos colegas' }, { description: 'Busca crescimento profissional atraves de resultados concretos' }] },
    { name: 'Construa como dono', description: 'Mentalidade de dono em todas as acoes', behaviors: [{ description: 'Cuida dos recursos e processos como se fossem seus' }, { description: 'Vai alem do escopo quando necessario para resolver problemas' }] },
    { name: 'Cultura de confronto com embasamento e respeito', description: 'Debater ideias com dados e respeito', behaviors: [{ description: 'Questiona decisoes de forma construtiva, trazendo dados e argumentos' }, { description: 'Acolhe opinioes divergentes e busca a melhor solucao coletiva' }] },
    { name: 'Foco radical no cliente', description: 'Cliente no centro de todas as decisoes', behaviors: [{ description: 'Busca entender profundamente as dores e necessidades do cliente' }, { description: 'Toma decisoes priorizando a experiencia e o valor para o cliente' }] },
    { name: 'Velocidade com precisao', description: 'Executar rapido sem perder qualidade', behaviors: [{ description: 'Entrega resultados com agilidade mantendo padrao de qualidade' }, { description: 'Identifica e remove obstaculos para acelerar entregas' }] },
    { name: 'Aprendizado continuo', description: 'Nunca parar de aprender e evoluir', behaviors: [{ description: 'Busca ativamente novos conhecimentos e habilidades' }, { description: 'Aplica aprendizados no dia a dia e compartilha com o time' }] },
    { name: 'Atalhos viciosos nao sao bem vindos', description: 'Fazer o certo mesmo quando e mais dificil', behaviors: [{ description: 'Segue processos e boas praticas mesmo sob pressao' }, { description: 'Prioriza solucoes sustentaveis ao inves de atalhos rapidos' }] },
  ];

  const createdValues = [];
  for (const v of valores) {
    const res = await fetch(BASE + '/values', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
    if (!res.ok) { console.error('Error creating value:', v.name, await res.text()); continue; }
    createdValues.push(await res.json());
  }
  console.log('Valores criados:', createdValues.length);

  // 2. Criar Colaboradores
  const employees = [
    { name: 'Carlos Silva', email: 'carlos@g4educacao.com', role: 'Diretor de Tecnologia', department: 'Tecnologia', isManager: true, isAdmin: true },
    { name: 'Ana Oliveira', email: 'ana@g4educacao.com', role: 'Tech Lead', department: 'Tecnologia', isManager: true },
    { name: 'Pedro Santos', email: 'pedro@g4educacao.com', role: 'Desenvolvedor Senior', department: 'Tecnologia' },
    { name: 'Maria Costa', email: 'maria@g4educacao.com', role: 'Desenvolvedora Pleno', department: 'Tecnologia' },
    { name: 'Lucas Ferreira', email: 'lucas@g4educacao.com', role: 'Desenvolvedor Junior', department: 'Tecnologia' },
    { name: 'Julia Mendes', email: 'julia@g4educacao.com', role: 'Product Manager', department: 'Produto' },
    { name: 'Roberto Lima', email: 'roberto@g4educacao.com', role: 'Designer UX', department: 'Design' },
  ];

  const createdEmployees = [];
  for (const e of employees) {
    const res = await fetch(BASE + '/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e) });
    if (!res.ok) { console.error('Error creating employee:', e.name, await res.text()); continue; }
    createdEmployees.push(await res.json());
  }

  if (createdEmployees.length < 2) {
    console.error('Not enough employees created, stopping.');
    return;
  }

  // Set manager relationships
  const carlos = createdEmployees[0];
  const ana = createdEmployees[1];
  await fetch(BASE + '/employees', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ana.id, managerId: carlos.id }) });
  for (let i = 2; i <= 4 && i < createdEmployees.length; i++) {
    await fetch(BASE + '/employees', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: createdEmployees[i].id, managerId: ana.id }) });
  }
  console.log('Colaboradores criados:', createdEmployees.length);

  // 3. Criar Ciclo
  const cycleRes = await fetch(BASE + '/cycles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Avaliacao 2026 Q1', description: 'Primeiro trimestre 2026', startDate: '2026-01-01', endDate: '2026-03-31' }) });
  if (!cycleRes.ok) { console.error('Error creating cycle:', await cycleRes.text()); return; }
  const cycle = await cycleRes.json();
  console.log('Ciclo criado:', cycle.name);

  // 4. Criar avaliacoes
  if (createdValues.length > 0 && createdEmployees.length >= 5) {
    const allBehaviors = createdValues.flatMap(v => v.behaviors.map(b => ({ ...b, valueName: v.name })));

    const evalData = [
      { subjectId: createdEmployees[2].id, evaluatorId: createdEmployees[2].id, type: 'self',
        strengths: 'Excelente capacidade tecnica, sempre entrega codigo de alta qualidade.',
        improvements: 'Precisa melhorar comunicacao em reunioes e documentacao.',
        cultureFreqs: allBehaviors.map(() => 3), resultsClass: 'acima_expectativa',
        resultsText: 'Entregou 120% da meta de sprints. Liderou a migracao do sistema legado com sucesso.' },
      { subjectId: createdEmployees[2].id, evaluatorId: createdEmployees[1].id, type: 'manager',
        strengths: 'Pedro e referencia tecnica da equipe. Resolve problemas complexos com facilidade.',
        improvements: 'Precisa desenvolver habilidades de lideranca e comunicacao com stakeholders.',
        cultureFreqs: allBehaviors.map(() => 4), resultsClass: 'acima_expectativa',
        resultsText: 'Superou todas as metas. Entregou o projeto de migracao 2 semanas antes do prazo.' },
      { subjectId: createdEmployees[3].id, evaluatorId: createdEmployees[3].id, type: 'self',
        strengths: 'Boa capacidade de aprendizado e adaptacao a novas tecnologias.',
        improvements: 'Preciso ser mais proativa em levantar problemas antes que se tornem criticos.',
        cultureFreqs: allBehaviors.map(() => 3), resultsClass: 'entrega',
        resultsText: 'Cumpri 100% das metas de sprint. Contribui para o projeto de redesign da API.' },
      { subjectId: createdEmployees[3].id, evaluatorId: createdEmployees[1].id, type: 'manager',
        strengths: 'Maria demonstra forte crescimento tecnico e boa colaboracao com a equipe.',
        improvements: 'Precisa desenvolver mais autonomia na tomada de decisoes.',
        cultureFreqs: allBehaviors.map(() => 3), resultsClass: 'entrega',
        resultsText: 'Entregou dentro do esperado. Boa qualidade de codigo.' },
    ];

    for (const ed of evalData) {
      const evalRes = await fetch(BASE + '/evaluations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cycleId: cycle.id, subjectId: ed.subjectId, evaluatorId: ed.evaluatorId, type: ed.type }) });
      if (!evalRes.ok) { console.error('Error creating eval:', await evalRes.text()); continue; }
      const ev = await evalRes.json();

      const score = ed.resultsClass === 'nao_entrega' ? 1 : ed.resultsClass === 'entrega' ? 2.5 : 4;
      await fetch(BASE + '/evaluations', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        id: ev.id,
        cultureEvaluations: allBehaviors.map((b, i) => ({ behaviorId: b.id, example: 'Demonstrou este comportamento no dia a dia.', frequency: ed.cultureFreqs[i] })),
        resultsEvaluation: { evidenceText: ed.resultsText, classification: ed.resultsClass, score },
        strengths: ed.strengths,
        improvements: ed.improvements,
        status: 'completed',
      }) });
      console.log('Avaliacao criada:', ed.type, 'para', ed.subjectId === createdEmployees[2].id ? 'Pedro' : 'Maria');
    }
  }

  console.log('\nSeed completo! Acesse: https://performance-evaluation-eight.vercel.app');
}

seed().catch(console.error);
