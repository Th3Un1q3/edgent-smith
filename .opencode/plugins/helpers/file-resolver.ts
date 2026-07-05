import { Glob } from "bun"

export const match = (pattern: string, filePath: string): boolean => {
  return new Glob(pattern).match(filePath)
}
