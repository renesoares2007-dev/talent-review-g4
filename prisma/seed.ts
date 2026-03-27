import { PrismaClient } from '../src/generated/prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create company values
  const valor1 = await prisma.companyValue.create({
    data: {
      name: 'Inovacao',
      description: 'Buscar solucoes criativas e desafiar o status quo',
      behaviors: {
        create: [
          { description: 'Propoe novas ideias e abordagens para problemas existentes' },
          { description: 'Adapta-se rapidamente a mudancas e novos cenarios' },
          { description: 'Busca aprendizado continuo e novas tecnologias' },
        ],
      },
    },
  })

  const valor2 = await prisma.companyValue.create({
    data: {
      name: 'Colaboracao',
      description: 'Trabalhar em equipe com transparencia e respeito',
      behaviors: {
        create: [
          { description: 'Compartilha conhecimento e informacoes com a equipe' },
          { description: 'Oferece e recebe feedback de forma construtiva' },
          { description: 'Contribui ativamente para o sucesso do time' },
        ],
      },
    },
  })

  const valor3 = await prisma.companyValue.create({
    data: {
      name: 'Excelencia',
      description: 'Entregar resultados de alta qualidade com responsabilidade',
      behaviors: {
        create: [
          { description: 'Entrega resultados com qualidade e dentro do prazo' },
          { description: 'Assume responsabilidade pelos seus compromissos' },
          { description: 'Busca melhoria continua nos processos' },
        ],
      },
    },
  })

  console.log('Values created:', valor1.name, valor2.name, valor3.name)

  // Create admin user
  const admin = await prisma.employee.create({
    data: {
      name: 'Administrador',
      email: 'admin@empresa.com',
      role: 'Administrador',
      department: 'RH',
      isAdmin: true,
      isManager: true,
    },
  })

  console.log('Admin created:', admin.email)

  // Create evaluation cycle
  const cycle = await prisma.evaluationCycle.create({
    data: {
      name: 'Avaliacao 2026 Q1',
      description: 'Primeiro ciclo de avaliacao',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      isActive: true,
    },
  })

  console.log('Cycle created:', cycle.name)
  console.log('Seed completed!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
