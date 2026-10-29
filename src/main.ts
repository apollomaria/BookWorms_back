import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configurarApp } from './app.setup';

// Ponto de entrada: é o primeiro arquivo executado por "npm run start".
// async/await: criar a aplicação e abrir a porta leva tempo; "await" faz o código
// esperar cada etapa terminar sem travar o servidor inteiro.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configurarApp(app); // ativa a validação dos DTOs
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
