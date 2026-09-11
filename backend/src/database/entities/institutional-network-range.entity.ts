import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// GAP-10 (RULE-DEV-14): allowlist of IP/CIDR ranges an institution declares
// as "inside the institutional network" — see "Decisão de tecnologia —
// Detecção de rede institucional / GAP-10 (2026-09-11)" in
// project-knowledge/references/architecture-overview.md. Shared by the
// device-binding creation check (Frente 12, GAP-10 stub already marked in
// device-binding.service.ts) and the future login-decision flow of Frente
// 13 (facial verification) — neither call site is wired here, only the data
// this round builds.
//
// Unlike device_binding_config (one row per tenant), this is deliberately N
// rows per tenant: an institution can have more than one range (main
// building + annex, a different WAN for guest Wi-Fi vs. the academic
// network). tenant_id is therefore NOT unique on its own here — only the
// (tenant_id, cidr) pair is (see migration).
@Entity({ name: 'institutional_network_range' })
export class InstitutionalNetworkRangeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  // Postgres' native `cidr` type, not varchar + a regex CHECK: the engine
  // itself rejects malformed CIDR notation AND rejects a network address
  // with host bits set (e.g. '192.168.1.5/24' — a host address, not a
  // range) at write time, for both IPv4 and IPv6 — strictly stronger
  // validation than a hand-written format check, for free. The future
  // InstitutionalNetworkService (Backend Agent, not built in this round)
  // reads this back as a plain string to feed `ipaddr.js`'s CIDR match,
  // per the approved Tech Decision.
  @Column({ type: 'cidr' })
  cidr: string;

  // Optional, institution-facing only (e.g. "Prédio principal", "Wi-Fi
  // convidados") — never read by matching logic, purely so the institution
  // can tell its own ranges apart when administering the list.
  @Column({ type: 'varchar', length: 255, nullable: true })
  label: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
