/**
 * Configurações que valem para a aplicação inteira.
 *
 * Ficam em uma função separada (e não direto no main.ts) para que o servidor
 * real e os testes automatizados usem EXATAMENTE a mesma configuração.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';

export function configurarApp(app: INestApplication): void {
  // Um "pipe" do Nest é uma etapa que roda entre a requisição e o controller.
  // O ValidationPipe aplica as regras dos decorators dos DTOs (@IsEmail etc.).
  app.useGlobalPipes(
    new ValidationPipe({
      // whitelist: campos que NÃO existem no DTO são descartados em silêncio.
      // Ex.: se alguém enviar { "nivel": 99 }, esse campo some antes de chegar
      // ao service. (Não usamos forbidNonWhitelisted para não quebrar um
      // frontend que envie campos a mais; ver docs/uc001-cadastro.md.)
      whitelist: true,
      // transform: converte o JSON "solto" em uma instância real do DTO.
      transform: true,
    }),
  );
}
