
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

/**
 * Responsável por conversar com o PostgreSQL. Os demais arquivos não conhecem
 * a biblioteca `pg`: pedem as consultas a este serviço.
 *
 * Pool = um grupo de conexões abertas e reaproveitadas. Abrir uma conexão a cada
 * requisição seria lento; o pool empresta uma conexão livre e a devolve depois.
 * Os dados de conexão vêm do arquivo .env (veja .env.example), nunca do código.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      host: this.configService.get<string>('DB_HOST'),
      port: this.configService.get<number>('DB_PORT'),
      user: this.configService.get<string>('DB_USERNAME'),
      password: this.configService.get<string>('DB_PASSWORD'),
      database: this.configService.get<string>('DB_DATABASE'),
    });
  }

  // Executa um comando SQL. `params` preenche $1, $2... do texto SQL.
  // O resultado tem `rows`: uma lista de objetos, um por linha devolvida
  // (ex.: [{ id: 1, nome_usuario: 'maria' }]).
  async query(sql: string, params: unknown[] = []) {
    return this.pool.query(sql, params);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
