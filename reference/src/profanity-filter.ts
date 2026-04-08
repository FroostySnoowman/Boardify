import { RegExpMatcher, TextCensor, englishDataset, englishRecommendedTransformers } from 'obscenity'

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
})

const censor = new TextCensor()

export function containsProfanity(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false
  }
  
  const matches = matcher.getAllMatches(text)
  return matches.length > 0
}

export function censorProfanity(text: string): string {
  if (!text || typeof text !== 'string') {
    return text
  }
  
  const matches = matcher.getAllMatches(text)
  return censor.applyTo(text, matches)
}