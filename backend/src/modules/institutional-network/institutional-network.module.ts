import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LeadershipScopeModule } from '../leadership-scope/leadership-scope.module';
import { InstitutionalNetworkRangeController } from './institutional-network-range.controller';
import { InstitutionalNetworkRangeService } from './institutional-network-range.service';
import { InstitutionalNetworkService } from './institutional-network.service';

// GAP-10 (RULE-DEV-14) — "Decisão de tecnologia — Detecção de rede
// institucional / GAP-10 (2026-09-11)"
// (project-knowledge/references/architecture-overview.md). Exports
// InstitutionalNetworkService (the shared, stateless match primitive) for
// cross-module consumption — DeviceBindingModule imports this module to
// call it from createBinding; the future Frente 13 login-decision module
// will do the same when it exists. InstitutionalNetworkRangeService/
// Controller (admin CRUD of the ranges table itself) stay internal to this
// module — nobody outside it needs to write to institutional_network_range
// directly.
@Module({
  imports: [AuthModule, LeadershipScopeModule],
  controllers: [InstitutionalNetworkRangeController],
  providers: [InstitutionalNetworkService, InstitutionalNetworkRangeService],
  exports: [InstitutionalNetworkService],
})
export class InstitutionalNetworkModule {}
