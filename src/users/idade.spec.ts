import {
  calcularIdade,
  idadePermitida,
  lerDataCivil,
} from './idade';

describe('idade (RN-002)', () => {
  describe('lerDataCivil', () => {
    it('aceita datas reais', () => {
      expect(lerDataCivil('2000-02-29')).toEqual({ ano: 2000, mes: 2, dia: 29 });
    });

    it.each(['2023-02-29', '2024-02-31', '2024-13-01', '2024-00-10', '2024-1-1', 'abc', ''])(
      'rejeita "%s"',
      (texto) => {
        expect(lerDataCivil(texto)).toBeNull();
      },
    );
  });

  describe('calcularIdade', () => {
    const hoje = { ano: 2026, mes: 6, dia: 15 };

    it('já fez aniversário no ano', () => {
      expect(calcularIdade({ ano: 2000, mes: 6, dia: 15 }, hoje)).toBe(26);
      expect(calcularIdade({ ano: 2000, mes: 1, dia: 1 }, hoje)).toBe(26);
    });

    it('ainda não fez aniversário no ano', () => {
      expect(calcularIdade({ ano: 2000, mes: 6, dia: 16 }, hoje)).toBe(25);
      expect(calcularIdade({ ano: 2000, mes: 12, dia: 31 }, hoje)).toBe(25);
    });

    it('data futura gera idade negativa', () => {
      expect(calcularIdade({ ano: 2027, mes: 1, dia: 1 }, hoje)).toBeLessThan(0);
    });
  });

  describe('idadePermitida (maior que 13 e menor que 150)', () => {
    it.each([
      [13, false],
      [14, true],
      [149, true],
      [150, false],
      [-1, false],
    ])('idade %i -> %s', (idade, esperado) => {
      expect(idadePermitida(idade)).toBe(esperado);
    });
  });
});
