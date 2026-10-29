/**
 * Funções puras (sem banco, sem Nest) para a regra RN-002 (faixa etária).
 * Ficam isoladas para serem fáceis de entender e de testar.
 */

export interface DataCivil {
  ano: number;
  mes: number; // 1 a 12
  dia: number; // 1 a 31
}

/**
 * Lê um texto "AAAA-MM-DD" e devolve ano/mês/dia, ou null se a data NÃO existe
 * no calendário (ex.: 2024-02-31, 2023-13-01, 2023-02-29).
 *
 * Usamos o objeto Date só para conferir: se o JavaScript "corrige" a data
 * (31/02 vira 03/03), significa que a original era inválida.
 */
export function lerDataCivil(texto: string): DataCivil | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!partes) return null;

  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);

  const conferencia = new Date(Date.UTC(ano, mes - 1, dia));
  const existe =
    conferencia.getUTCFullYear() === ano &&
    conferencia.getUTCMonth() === mes - 1 &&
    conferencia.getUTCDate() === dia;

  return existe ? { ano, mes, dia } : null;
}

/**
 * Idade completa (em anos) de quem nasceu em `nascimento`, na data `hoje`.
 * Se o aniversário deste ano ainda não chegou, desconta 1 ano.
 * Resultado negativo significa data de nascimento no futuro.
 */
export function calcularIdade(nascimento: DataCivil, hoje: DataCivil): number {
  let idade = hoje.ano - nascimento.ano;
  const aindaNaoFezAniversario =
    hoje.mes < nascimento.mes ||
    (hoje.mes === nascimento.mes && hoje.dia < nascimento.dia);
  if (aindaNaoFezAniversario) idade -= 1;
  return idade;
}

/**
 * RN-002: "A idade de um usuário deve ser maior que 13 e menor que 150".
 * Interpretação adotada: idade em anos completos, com 13 < idade < 150
 * (ou seja, de 14 a 149 anos). A interpretação está registrada como pendência
 * de confirmação em docs/uc001-cadastro.md.
 */
export const IDADE_MINIMA_EXCLUSIVA = 13;
export const IDADE_MAXIMA_EXCLUSIVA = 150;

export function idadePermitida(idade: number): boolean {
  return idade > IDADE_MINIMA_EXCLUSIVA && idade < IDADE_MAXIMA_EXCLUSIVA;
}
