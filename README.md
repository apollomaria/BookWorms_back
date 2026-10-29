# BookWorms — backend (NestJS)

Substitui o README padrão do NestJS. Visão geral do projeto: `../README.md`.

```bash
cp .env.example .env     # preencha com seus dados LOCAIS
npm install
npm run start:dev        # servidor em http://localhost:3000
npm run build            # compila para dist/
npm run lint
npm test                 # unitários (Node >= 24.9; não usa banco)
npm run test:e2e         # HTTP com banco em memória (Node >= 24.9)
```

Implementado: UC001 (cadastro) — `POST /users`. Documentação em `../docs/`.
