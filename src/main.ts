import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configurarApp } from './app.setup';

// Ponto de entrada: é o primeiro arquivo executado por "npm run start".
// async/await: criar a aplicação e abrir a porta leva tempo; "await" faz o código
// esperar cada etapa terminar sem travar o servidor inteiro.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configurarApp(app); // ativa a validação dos DTOs

  // HABILITAR O CORS PARA PERMITIR REQUISIÇÕES DO FRONT-END (VITE)
  // A origem permitida pode ser trocada pelo .env (CORS_ORIGIN) sem mexer no código;
  // sem a variável, vale o endereço padrão do Vite.
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });


  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
