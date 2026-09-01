import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'tenant' })
export class TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'institution_type', type: 'varchar', length: 50 })
  institutionType: string;

  // RULE-INST-02: collected by the public self-service onboarding screen
  // (name/CNPJ/address). Nullable at the DB level on purpose — the
  // pre-existing TenantBootstrapService/tenant-create.ts CLI path (kept for
  // test/CI only, per RULE-INST-02's second-round update) does not supply
  // these; requiredness for the real onboarding flow is enforced by that
  // controller's own DTO, not a blanket DB invariant. See
  // AddTenantInstitutionProfile migration.
  @Column({ type: 'varchar', length: 14, nullable: true })
  cnpj: string | null;

  @Column({ name: 'address_street', type: 'varchar', length: 255, nullable: true })
  addressStreet: string | null;

  @Column({ name: 'address_number', type: 'varchar', length: 20, nullable: true })
  addressNumber: string | null;

  @Column({ name: 'address_complement', type: 'varchar', length: 255, nullable: true })
  addressComplement: string | null;

  @Column({ name: 'address_neighborhood', type: 'varchar', length: 255, nullable: true })
  addressNeighborhood: string | null;

  @Column({ name: 'address_city', type: 'varchar', length: 255, nullable: true })
  addressCity: string | null;

  @Column({ name: 'address_state', type: 'varchar', length: 2, nullable: true })
  addressState: string | null;

  @Column({ name: 'address_zip_code', type: 'varchar', length: 8, nullable: true })
  addressZipCode: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
