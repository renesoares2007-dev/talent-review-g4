const BASE = 'http://localhost:3000/api';

async function seed() {
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
    createdValues.push(await res.json());
  }
  console.log('Valores criados:', createdValues.length);

  // 2. Criar Colaboradores
  const employees = [
    { name: 'Carlos Silva', email: 'carlos@empresa.com', role: 'Diretor de Tecnologia', department: 'Tecnologia', isManager: true, isAdmin: true },
    { name: 'Ana Oliveira', email: 'ana@empresa.com', role: 'Tech Lead', department: 'Tecnologia', isManager: true },
    { name: 'Pedro Santos', email: 'pedro@empresa.com', role: 'Desenvolvedor Senior', department: 'Tecnologia' },
    { name: 'Maria Costa', email: 'maria@empresa.com', role: 'Desenvolvedora Pleno', department: 'Tecnologia' },
    { name: 'Lucas Ferreira', email: 'lucas@empresa.com', role: 'Desenvolvedor Junior', department: 'Tecnologia' },
    { name: 'Julia Mendes', email: 'julia@empresa.com', role: 'Product Manager', department: 'Produto' },
    { name: 'Roberto Lima', email: 'roberto@empresa.com', role: 'Designer UX', department: 'Design' },
  ];

  const createdEmployees = [];
  for (const e of employees) {
    const res = await fetch(BASE + '/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e) });
    createdEmployees.push(await res.json());
  }

  const carlos = createdEmployees[0];
  const ana = createdEmployees[1];
  await fetch(BASE + '/employees', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ana.id, managerId: carlos.id }) });
  for (let i = 2; i <= 4; i++) {
    await fetch(BASE + '/employees', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: createdEmployees[i].id, managerId: ana.id }) });
  }
  console.log('Colaboradores criados:', createdEmployees.length);

  // Preencher perfis demo
  const profiles = [
    {
      id: carlos.id,
      aboutMe: 'Diretor de Tecnologia com mais de 15 anos de experiencia em desenvolvimento de software e gestao de equipes. Apaixonado por inovacao e por construir times de alta performance. Acredito que tecnologia transforma negocios quando aliada a uma cultura forte.',
      achievements: JSON.stringify(['Liderou a transformacao digital da empresa, reduzindo custos operacionais em 35%', 'Construiu o time de tecnologia de 3 para 25 pessoas em 2 anos', 'Implementou cultura DevOps que reduziu tempo de deploy de 2 dias para 15 minutos', 'Speaker no G4 Club sobre escalabilidade de times tech']),
      recognitions: JSON.stringify(['Melhor lideranca tecnica - G4 Awards 2025', 'Destaque em inovacao - Premio interno Q3 2025', 'Mentor do programa de aceleracao de talentos']),
      education: JSON.stringify(['MBA em Gestao de Tecnologia - FGV (2018)', 'Bacharel em Ciencia da Computacao - USP (2010)', 'AWS Solutions Architect Professional', 'Certificacao em Lideranca Executiva - Insper (2023)']),
      careerInterests: 'Meu objetivo e me tornar CTO de uma empresa de tecnologia de grande porte. Tenho interesse em inteligencia artificial aplicada a gestao de pessoas e em escalar organizacoes de tecnologia mantendo a cultura de alta performance.',
    },
    {
      id: ana.id,
      aboutMe: 'Tech Lead apaixonada por desenvolvimento de software e mentoria. Com 8 anos de experiencia, lidero o time de engenharia focando em qualidade de codigo, boas praticas e crescimento do time. Defensora de code reviews construtivos e aprendizado continuo.',
      achievements: JSON.stringify(['Liderou a migracao do monolito para microsservicos, melhorando a disponibilidade para 99.9%', 'Implementou programa de mentoria tecnica que acelerou a promocao de 3 devs', 'Reduziu o tempo de onboarding de novos devs de 4 semanas para 1 semana', 'Criou framework interno de testes que aumentou cobertura de 45% para 92%']),
      recognitions: JSON.stringify(['Tech Lead do ano - Tecnologia 2025', 'Destaque em mentoria - People Awards Q2 2025', 'Reconhecida pela equipe como melhor gestora tecnica']),
      education: JSON.stringify(['Pos-graduacao em Engenharia de Software - FIAP (2020)', 'Bacharel em Sistemas de Informacao - PUC-SP (2017)', 'Google Cloud Professional Cloud Architect', 'Scrum Master Certified (CSM)']),
      careerInterests: 'Busco evoluir para uma posicao de Engineering Manager, combinando habilidades tecnicas com gestao de pessoas. Tenho forte interesse em arquitetura de sistemas distribuidos e em desenvolver a proxima geracao de lideres tecnicos.',
    },
    {
      id: createdEmployees[2].id, // Pedro
      aboutMe: 'Desenvolvedor Senior com foco em backend e arquitetura de sistemas. Gosto de resolver problemas complexos e compartilhar conhecimento com a equipe. Nos ultimos 5 anos venho me especializando em sistemas de alta disponibilidade e performance.',
      achievements: JSON.stringify(['Liderou tecnicamente a migracao do sistema legado, reduzindo bugs em 40%', 'Desenvolveu API de integracao que processa 50k requisicoes/min', 'Criou biblioteca interna de utilidades adotada por 3 times', 'Apresentou talk sobre Clean Architecture no meetup interno']),
      recognitions: JSON.stringify(['Dev destaque Q1 2026 - Melhor entrega tecnica', 'Reconhecimento por mentoria de desenvolvedores juniores', 'Contribuicao excepcional no projeto de Black Friday 2025']),
      education: JSON.stringify(['Bacharel em Engenharia de Computacao - Unicamp (2019)', 'Especializacao em Arquitetura de Software - Alura (2022)', 'AWS Developer Associate', 'Kubernetes Application Developer (CKAD)']),
      careerInterests: 'Quero me tornar Staff Engineer, com foco em decisoes arquiteturais e mentoria tecnica cross-team. Tambem tenho interesse em contribuir para open source e me aprofundar em sistemas distribuidos.',
    },
    {
      id: createdEmployees[3].id, // Maria
      aboutMe: 'Desenvolvedora Pleno com 3 anos de experiencia, focada em fullstack com React e Node.js. Estou em constante aprendizado e busco sempre entender o "porque" por tras das decisoes tecnicas. Gosto de trabalhar em equipe e contribuir para um ambiente colaborativo.',
      achievements: JSON.stringify(['Contribuiu para o redesign da API REST, melhorando tempo de resposta em 30%', 'Implementou sistema de notificacoes real-time com WebSockets', 'Automatizou pipeline de deploy do time, economizando 4h/semana']),
      recognitions: JSON.stringify(['Destaque em crescimento tecnico - Q4 2025', 'Reconhecida pela equipe por colaboracao e proatividade']),
      education: JSON.stringify(['Bacharel em Ciencia da Computacao - UFRJ (2022)', 'Bootcamp Fullstack - Rocketseat (2021)', 'React Advanced Certification - Meta (2024)']),
      careerInterests: 'Meu proximo passo e me tornar Desenvolvedora Senior. Quero me aprofundar em arquitetura frontend e design systems. Tambem tenho interesse em product engineering e em entender melhor as necessidades do usuario final.',
    },
    {
      id: createdEmployees[4].id, // Lucas
      aboutMe: 'Desenvolvedor Junior no inicio da carreira, entusiasmado com tecnologia e com muita vontade de aprender. Tenho facilidade com frontend e estou me aprofundando em React e TypeScript. Aceito feedback de forma positiva e busco evoluir rapidamente.',
      achievements: JSON.stringify(['Desenvolveu componentes do design system em React', 'Contribuiu para o frontend do projeto de avaliacoes de desempenho', 'Completou trilha de React avancado em tempo recorde']),
      recognitions: JSON.stringify(['Destaque como revelacao do time - Q1 2026']),
      education: JSON.stringify(['Cursando Analise e Desenvolvimento de Sistemas - Fatec (previsao 2027)', 'Bootcamp Frontend - Trybe (2025)', 'JavaScript Algorithms - freeCodeCamp']),
      careerInterests: 'Quero me tornar um desenvolvedor Pleno em 1 ano. Tenho grande interesse em React, TypeScript e UX engineering. No futuro, gostaria de explorar mobile com React Native.',
    },
    {
      id: createdEmployees[5].id, // Julia
      aboutMe: 'Product Manager com experiencia em produtos digitais B2B. Trabalho na intersecao entre tecnologia, design e negocio para criar produtos que resolvem problemas reais dos usuarios. Sou orientada a dados e apaixonada por discovery.',
      achievements: JSON.stringify(['Lancou 3 features que aumentaram retencao de usuarios em 25%', 'Implementou processo de product discovery que reduziu retrabalho em 40%', 'Conduziu pesquisa com 200+ usuarios para redesign do produto principal']),
      recognitions: JSON.stringify(['PM do trimestre - Q3 2025', 'Destaque em colaboracao cross-funcional']),
      education: JSON.stringify(['MBA em Gestao de Produtos Digitais - PM3 (2023)', 'Bacharel em Administracao - Insper (2019)', 'Product Analytics Certification - Amplitude']),
      careerInterests: 'Busco evoluir para Head de Produto. Tenho interesse em product-led growth e em construir equipes de produto autonomas e orientadas a resultado.',
    },
    {
      id: createdEmployees[6].id, // Roberto
      aboutMe: 'Designer UX com 4 anos de experiencia criando experiencias digitais centradas no usuario. Combino pesquisa qualitativa com design visual para criar interfaces intuitivas e acessiveis. Defensor de design inclusivo e acessibilidade.',
      achievements: JSON.stringify(['Redesenhou o fluxo de onboarding, aumentando conversao em 45%', 'Criou o design system da empresa com 80+ componentes', 'Conduziu 50+ testes de usabilidade no ultimo ano']),
      recognitions: JSON.stringify(['Designer do ano - Creative Awards 2025', 'Reconhecimento por acessibilidade - Compliance team']),
      education: JSON.stringify(['Bacharel em Design Digital - ESPM (2021)', 'UX Research Certification - Nielsen Norman Group (2023)', 'Curso de Design Inclusivo - Google (2024)']),
      careerInterests: 'Meu objetivo e me tornar Design Lead, liderando a estrategia de experiencia do usuario. Tenho interesse em design ops, pesquisa quantitativa e em criar uma cultura de design dentro da organizacao.',
    },
  ];

  for (const profile of profiles) {
    await fetch(BASE + '/employees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
  }
  console.log('Perfis demo preenchidos:', profiles.length);

  // 3. Criar Ciclo
  const cycleRes = await fetch(BASE + '/cycles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Avaliacao 2026 Q1', description: 'Primeiro trimestre 2026', startDate: '2026-01-01', endDate: '2026-03-31' }) });
  const cycle = await cycleRes.json();
  console.log('Ciclo criado:', cycle.name);

  // 4. Criar 5 avaliacoes completas
  const allBehaviors = createdValues.flatMap(v => v.behaviors.map(b => ({ ...b, valueName: v.name })));

  const evalData = [
    { subjectId: createdEmployees[2].id, evaluatorId: createdEmployees[2].id, type: 'self',
      strengths: 'Excelente capacidade tecnica, sempre entrega codigo de alta qualidade.',
      improvements: 'Precisa melhorar comunicacao em reunioes e documentacao.',
      cultureFreqs: [3, 3, 4, 3, 3, 3, 4, 3, 3, 3, 3, 4, 3, 3, 3, 3, 4, 3, 3, 3], resultsClass: 'acima_expectativa',
      resultsText: 'Entregou 120% da meta de sprints. Liderou a migracao do sistema legado com sucesso, reduzindo bugs em 40%.' },
    { subjectId: createdEmployees[2].id, evaluatorId: createdEmployees[1].id, type: 'manager',
      strengths: 'Pedro e referencia tecnica da equipe. Resolve problemas complexos com facilidade e mentora os juniores.',
      improvements: 'Precisa desenvolver habilidades de lideranca e comunicacao com stakeholders.',
      cultureFreqs: [4, 3, 3, 4, 3, 3, 4, 3, 3, 4, 3, 3, 4, 3, 3, 4, 3, 3, 3, 3], resultsClass: 'acima_expectativa',
      resultsText: 'Superou todas as metas. Entregou o projeto de migracao 2 semanas antes do prazo.' },
    { subjectId: createdEmployees[3].id, evaluatorId: createdEmployees[3].id, type: 'self',
      strengths: 'Boa capacidade de aprendizado e adaptacao a novas tecnologias.',
      improvements: 'Preciso ser mais proativa em levantar problemas antes que se tornem criticos.',
      cultureFreqs: [3, 2, 3, 3, 2, 3, 3, 2, 3, 3, 2, 3, 3, 2, 3, 3, 2, 3, 3, 2], resultsClass: 'entrega',
      resultsText: 'Cumpri 100% das metas de sprint. Contribui para o projeto de redesign da API.' },
    { subjectId: createdEmployees[3].id, evaluatorId: createdEmployees[1].id, type: 'manager',
      strengths: 'Maria demonstra forte crescimento tecnico e boa colaboracao com a equipe.',
      improvements: 'Precisa desenvolver mais autonomia na tomada de decisoes e melhorar estimativas.',
      cultureFreqs: [2, 3, 3, 3, 3, 2, 2, 3, 3, 3, 3, 2, 2, 3, 3, 3, 3, 2, 3, 2], resultsClass: 'entrega',
      resultsText: 'Entregou dentro do esperado. Boa qualidade de codigo. Crescimento consistente.' },
    { subjectId: createdEmployees[4].id, evaluatorId: createdEmployees[4].id, type: 'self',
      strengths: 'Tenho vontade de aprender e aceito feedback positivamente.',
      improvements: 'Preciso melhorar velocidade de entrega e aprofundar conhecimento em arquitetura.',
      cultureFreqs: [2, 2, 3, 3, 2, 2, 2, 2, 3, 3, 2, 2, 2, 2, 3, 3, 2, 2, 2, 2], resultsClass: 'entrega',
      resultsText: 'Entreguei as tarefas designadas no sprint. Aprendi React e contribui para o frontend.' },
  ];

  for (const ed of evalData) {
    const evalRes = await fetch(BASE + '/evaluations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cycleId: cycle.id, subjectId: ed.subjectId, evaluatorId: ed.evaluatorId, type: ed.type }) });
    const ev = await evalRes.json();

    const score = ed.resultsClass === 'nao_entrega' ? 1 : ed.resultsClass === 'entrega' ? 2.5 : 4;
    await fetch(BASE + '/evaluations', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      id: ev.id,
      cultureEvaluations: allBehaviors.map((b, i) => ({ behaviorId: b.id, example: 'Demonstrou este comportamento consistentemente no dia a dia do projeto.', frequency: ed.cultureFreqs[i] })),
      resultsEvaluation: { evidenceText: ed.resultsText, classification: ed.resultsClass, score },
      strengths: ed.strengths,
      improvements: ed.improvements,
      status: 'completed',
    }) });
    console.log('Avaliacao criada:', ed.type, '-', employees.find(e => e.email === (ed.subjectId === createdEmployees[2].id ? 'pedro@empresa.com' : ed.subjectId === createdEmployees[3].id ? 'maria@empresa.com' : 'lucas@empresa.com'))?.name);
  }

  // 5. Consolidar Pedro e Maria (tem auto + gestor)
  for (const emp of [createdEmployees[2], createdEmployees[3]]) {
    const res = await fetch(BASE + '/consolidated', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cycleId: cycle.id, subjectId: emp.id }) });
    const data = await res.json();
    console.log('Consolidado:', emp.name || emp.id.slice(0,8), '- Ninebox:', data.nineboxPosition);
  }

  console.log('\nSeed completo!');
}

seed().catch(console.error);
