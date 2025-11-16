export interface GameResult {
  id: string
  result:  'player' | 'tie' | 'banker'
  score: string
  table: string
}