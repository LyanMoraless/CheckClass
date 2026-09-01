import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { InfoBanner } from '../../components/info-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { createHoliday, deleteHoliday, listHolidays, type Holiday } from './holidays-api';
import styles from './holidays-page.module.css';

// Institutional calendar CRUD (RULE-INST-04's holiday exception). Deliberately
// its own top-level screen under Configurações, not nested under a turma —
// a holiday applies to the whole institution, unlike the recurring
// grade/sessions of Cronograma, which are always turma-scoped (see
// class-schedule feature).
export function HolidaysPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_institution_structure');
  const queryClient = useQueryClient();

  const { data: holidays, isLoading, error } = useQuery({ queryKey: ['holidays'], queryFn: listHolidays });

  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const createMutation = useMutation({
    mutationFn: createHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      setDate('');
      setName('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHoliday,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holidays'] }),
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate({ date, name });
  }

  function formatDate(value: string): string {
    // "YYYY-MM-DD" parsed as UTC midnight — avoids the classic
    // off-by-one-day bug from letting the browser apply local timezone.
    return new Date(`${value}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  }

  return (
    <section>
      <PageHeader
        icon={CalendarOff}
        area="settings"
        title="Feriados"
        description="Feriados são institucionais — se aplicam a toda a instituição, não a uma turma ou sala específica."
      />
      <InfoBanner message="Marcar um feriado numa data que já tenha aulas geradas cancela automaticamente essas sessões." />

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {deleteMutation.isError && <ErrorBanner message={errorMessage(deleteMutation.error)} />}
      {holidays && (
        <DataTable<Holiday>
          rows={holidays}
          getRowKey={(holiday) => holiday.id}
          columns={[
            { header: 'Data', cell: (holiday) => formatDate(holiday.date) },
            { header: 'Nome', cell: (holiday) => holiday.name },
            {
              header: 'Ações',
              cell: (holiday) => (
                <button
                  type="button"
                  className={`danger ${styles.iconButton}`}
                  disabled={!canManage || deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(holiday.id)}
                >
                  <Trash2 size={16} />
                  Remover
                </button>
              ),
            },
          ]}
        />
      )}

      <fieldset disabled={!canManage}>
        <legend>Novo feriado</legend>
        {!canManage && <PermissionHint permission="manage_institution_structure" />}
        <form onSubmit={handleSubmit}>
          {createMutation.isError && <ErrorBanner message={errorMessage(createMutation.error)} />}
          <label>
            Data
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <label>
            Nome
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} required maxLength={255} />
          </label>
          <button type="submit" className={styles.iconButton} disabled={createMutation.isPending || !date || !name}>
            <Plus size={16} />
            {createMutation.isPending ? 'Criando…' : 'Criar feriado'}
          </button>
        </form>
      </fieldset>
    </section>
  );
}
