
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ReadingLogsModule } from './reading-logs/reading-logs.module';

// Módulo raiz: junta as peças da aplicação. ConfigModule lê o arquivo .env e
// disponibiliza as variáveis (DB_HOST, DB_PORT...) via ConfigService.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    ReadingLogsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

