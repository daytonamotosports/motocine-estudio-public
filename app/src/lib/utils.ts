// COPIA de orion-pos webapp/src/lib/utils.ts (20-oct-2026); no editar a mano en orion-pos por esta app.
// Recortada: solo `cn` (lo único que usa el kit).
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
