import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AppCheckinController } from './app-checkin.controller';
import { AppCheckinService } from './app-checkin.service';

// RULE-ATT-06's confirmed note: the app check-in submission path, kept as
// its own feature module — structurally separate from IngestionModule (the
// device-authenticated contract it deliberately does not reuse) — that
// feeds the existing Identification/Deduplication/Motor-de-Regras pipeline.
@Module({
  imports: [AuthModule],
  controllers: [AppCheckinController],
  providers: [AppCheckinService],
})
export class AppCheckinModule {}
