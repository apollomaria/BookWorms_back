import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ReadingLogsController } from './reading-logs.controller';
import { ReadingLogsService } from './reading-logs.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ReadingLogsController],
  providers: [ReadingLogsService],
})
export class ReadingLogsModule {}
