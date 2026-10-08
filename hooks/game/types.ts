/** The seven four-cell pieces, named by the letter each one resembles. */
export type Kind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

/** A cell position: x is the column from the left, y the row from the top. */
export type Point = { readonly x: number; readonly y: number }
