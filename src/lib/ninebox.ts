export type NineboxPosition = 'talento_g4' | 'game_changer' | 'expert' | 'recover' | 'dismissal'

export interface NineboxResult {
  position: NineboxPosition
  label: string
  color: string
  description: string
}

export function calculateNinebox(cultureScore: number, resultsScore: number): NineboxResult {
  const c = Math.round(cultureScore)
  const r = Math.round(resultsScore)

  // Talento G4: ambos 4
  if (c >= 4 && r >= 4) {
    return {
      position: 'talento_g4',
      label: 'Talento G4',
      color: '#22c55e',
      description: 'Referência em Cultura e Resultados'
    }
  }

  // Game Changer: um 4 e outro 3
  if ((c >= 4 && r >= 3) || (r >= 4 && c >= 3)) {
    return {
      position: 'game_changer',
      label: 'Game Changer',
      color: '#3b82f6',
      description: 'Alto desempenho em um ou ambos os eixos'
    }
  }

  // Expert: ambos 3
  if (c >= 3 && r >= 3) {
    return {
      position: 'expert',
      label: 'Expert',
      color: '#8b5cf6',
      description: 'Bom desempenho consistente em ambos os eixos'
    }
  }

  // Recover: um 2 e outro 3, ou um 3 e outro 2
  if ((c >= 2 && r >= 3) || (r >= 2 && c >= 3)) {
    return {
      position: 'recover',
      label: 'Recover',
      color: '#f59e0b',
      description: 'Precisa de desenvolvimento em um dos eixos'
    }
  }

  // Dismissal: ambos 2 ou abaixo
  return {
    position: 'dismissal',
    label: 'Dismissal',
    color: '#ef4444',
    description: 'Desempenho abaixo do esperado em ambos os eixos'
  }
}

export function getNineboxGridPosition(cultureScore: number, resultsScore: number): { row: number; col: number } {
  const c = Math.min(Math.max(Math.round(cultureScore), 0), 4)
  const r = Math.min(Math.max(Math.round(resultsScore), 0), 4)
  return { row: 4 - c, col: r }
}
