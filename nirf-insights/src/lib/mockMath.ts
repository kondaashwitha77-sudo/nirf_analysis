import { quantile } from './stats'

export const median = (values: number[]): number => quantile([...values].sort((a, b) => a - b), 0.5)
