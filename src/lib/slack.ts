interface SlackMessage {
  channel?: string
  text: string
  blocks?: SlackBlock[]
}

interface SlackBlock {
  type: string
  text?: { type: string; text: string; emoji?: boolean }
  elements?: { type: string; text: string }[]
  fields?: { type: string; text: string }[]
}

interface SlackConfig {
  botToken?: string | null
  webhookUrl?: string | null
  channel?: string | null
}

// Send message via Bot Token (supports DMs by email)
async function sendViaBotToken(token: string, message: SlackMessage): Promise<boolean> {
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  })
  const data = await res.json()
  if (!data.ok) console.error('Slack API error:', data.error)
  return data.ok === true
}

// Look up Slack user by email
async function lookupUserByEmail(token: string, email: string): Promise<string | null> {
  const res = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  const data = await res.json()
  if (!data.ok) return null
  return data.user?.id || null
}

// Open DM channel with user
async function openDMChannel(token: string, userId: string): Promise<string | null> {
  const res = await fetch('https://slack.com/api/conversations.open', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ users: userId }),
  })
  const data = await res.json()
  if (!data.ok) return null
  return data.channel?.id || null
}

// Send message via Webhook (channel only)
async function sendViaWebhook(webhookUrl: string, message: SlackMessage): Promise<boolean> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: message.text,
      blocks: message.blocks,
    }),
  })
  return res.ok
}

// Send DM to a specific user by email
export async function sendSlackDM(
  config: SlackConfig,
  email: string,
  message: SlackMessage
): Promise<boolean> {
  if (!config.botToken) return false

  const userId = await lookupUserByEmail(config.botToken, email)
  if (!userId) {
    console.warn(`Slack user not found for email: ${email}`)
    return false
  }

  const channelId = await openDMChannel(config.botToken, userId)
  if (!channelId) return false

  return sendViaBotToken(config.botToken, { ...message, channel: channelId })
}

// Send message to channel
export async function sendSlackChannel(
  config: SlackConfig,
  message: SlackMessage
): Promise<boolean> {
  if (config.webhookUrl) {
    return sendViaWebhook(config.webhookUrl, message)
  }
  if (config.botToken && config.channel) {
    return sendViaBotToken(config.botToken, { ...message, channel: config.channel })
  }
  return false
}

// Build notification blocks for pending evaluations
export function buildPendingNotificationBlocks(
  employeeName: string,
  cycleName: string,
  pendingEvals: { type: string; subjectName: string }[]
): SlackBlock[] {
  const evalLines = pendingEvals.map(e => {
    const typeLabel = e.type === 'self' ? 'Autoavaliacao' : e.type === 'manager' ? 'Avaliacao de Gestor' : 'Stakeholder'
    return `• ${typeLabel} - ${e.subjectName}`
  }).join('\n')

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📋 Avaliacoes Pendentes - Talent Review G4', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Ola *${employeeName}*! Voce tem avaliacoes pendentes no ciclo *${cycleName}*:`,
      },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: evalLines },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Acesse a plataforma para completar suas avaliacoes.',
      },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '_Enviado automaticamente pelo Talent Review G4_' }],
    },
  ]
}

// Build summary blocks for channel notification
export function buildChannelSummaryBlocks(
  cycleName: string,
  pendingByPerson: { name: string; email: string; count: number }[]
): SlackBlock[] {
  const total = pendingByPerson.reduce((sum, p) => sum + p.count, 0)
  const lines = pendingByPerson.map(p => `• *${p.name}* - ${p.count} pendente(s)`).join('\n')

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📊 Resumo de Pendencias - Talent Review G4', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Ciclo:*\n${cycleName}` },
        { type: 'mrkdwn', text: `*Total pendentes:*\n${total} avaliacao(oes)` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Colaboradores com pendencias:*\n${lines}` },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '_Enviado automaticamente pelo Talent Review G4_' }],
    },
  ]
}
