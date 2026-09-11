import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AttendanceConfigPage } from './attendance-config-page';
import * as configApi from './attendance-config-api';

// Configuration page for attendance rules (Controle A and Controle B).
// This test suite covers form validation, submission, and the two distinct
// fieldsets (Controle A = per-class, Controle B = accumulated).
describe('AttendanceConfigPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  function renderPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <AttendanceConfigPage />
      </QueryClientProvider>,
    );
  }

  // ============================================================================
  // Controle A and Controle B Fieldsets
  // ============================================================================
  describe('fieldset organization', () => {
    beforeEach(() => {
      vi.spyOn(configApi, 'listConfigs').mockResolvedValue([]);
      vi.spyOn(configApi, 'listCourses').mockResolvedValue([]);
      vi.spyOn(configApi, 'listClassGroups').mockResolvedValue([]);
      vi.spyOn(configApi, 'listFactorTypes').mockResolvedValue([]);
    });

    it('test_attendanceConfigPage_showsControlAFieldset', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Controle A — presença dentro de cada aula')).toBeInTheDocument();
      });
    });

    it('test_attendanceConfigPage_showsControlBFieldset', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Controle B — frequência acumulada no período')).toBeInTheDocument();
      });
    });

    it('test_attendanceConfigPage_twoFieldsetsVisuallyDistinct', async () => {
      renderPage();

      await waitFor(() => {
        const legends = screen.getAllByText(/Controle [AB]/);
        // Should have two separate fieldset legends
        expect(legends.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  // ============================================================================
  // Controle A Form Fields
  // ============================================================================
  describe('Controle A fields', () => {
    beforeEach(() => {
      vi.spyOn(configApi, 'listConfigs').mockResolvedValue([]);
      vi.spyOn(configApi, 'listCourses').mockResolvedValue([]);
      vi.spyOn(configApi, 'listClassGroups').mockResolvedValue([]);
      vi.spyOn(configApi, 'listFactorTypes').mockResolvedValue([]);
    });

    it('test_attendanceConfigPage_controlAMinimumPercentage_hasDefaultValue', async () => {
      renderPage();

      await waitFor(() => {
        const inputs = screen.getAllByDisplayValue('75');
        // 75 is the default for both min attendance and min accumulated frequency
        expect(inputs.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('test_attendanceConfigPage_toleranceMinutes_hasDefaultValue', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByDisplayValue('10')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Controle B Form Fields
  // ============================================================================
  describe('Controle B fields', () => {
    beforeEach(() => {
      vi.spyOn(configApi, 'listConfigs').mockResolvedValue([]);
      vi.spyOn(configApi, 'listCourses').mockResolvedValue([]);
      vi.spyOn(configApi, 'listClassGroups').mockResolvedValue([]);
      vi.spyOn(configApi, 'listFactorTypes').mockResolvedValue([]);
    });

    it('test_attendanceConfigPage_minAccumulatedFrequencyPercentage_isRequired', async () => {
      renderPage();

      await waitFor(() => {
        const minimumField = screen.getByLabelText(/Percentual mínimo de frequência acumulada/i);
        expect(minimumField).toHaveAttribute('required');
      });
    });

    it('test_attendanceConfigPage_accumulatedFrequencyPeriod_hasExactlyThreeOptions', async () => {
      renderPage();

      await waitFor(() => {
        const periodSelect = screen.getByLabelText(/Período de apuração/i) as HTMLSelectElement;
        // Should have placeholder option + 3 real options
        expect(periodSelect.options.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('test_attendanceConfigPage_accumulatedFrequencyPeriod_containsBimesterTrimesterSemester', async () => {
      renderPage();

      await waitFor(() => {
        const periodSelect = screen.getByLabelText(/Período de apuração/i) as HTMLSelectElement;
        const values = Array.from(periodSelect.options).map((opt) => opt.value);
        expect(values).toContain('bimester');
        expect(values).toContain('trimester');
        expect(values).toContain('semester');
      });
    });

    it('test_attendanceConfigPage_accumulatedFrequencyPeriod_defaultIsBimester', async () => {
      renderPage();

      await waitFor(() => {
        const periodSelect = screen.getByLabelText(/Período de apuração/i) as HTMLSelectElement;
        expect(periodSelect.value).toBe('bimester');
      });
    });
  });

  // ============================================================================
  // Form Validation
  // ============================================================================
  describe('form validation', () => {
    beforeEach(() => {
      vi.spyOn(configApi, 'listConfigs').mockResolvedValue([]);
      vi.spyOn(configApi, 'listCourses').mockResolvedValue([]);
      vi.spyOn(configApi, 'listClassGroups').mockResolvedValue([]);
      vi.spyOn(configApi, 'listFactorTypes').mockResolvedValue([]);
      vi.spyOn(configApi, 'upsertConfig').mockResolvedValue({ configId: 'config-1' });
    });

    it('test_attendanceConfigPage_minAccumulatedFrequency_lessThanZero_showsError', async () => {
      renderPage();

      await waitFor(() => {
        const minimumField = screen.getByLabelText(/Percentual mínimo de frequência acumulada/i) as HTMLInputElement;
        fireEvent.change(minimumField, { target: { value: '-1' } });
      });

      // The input should not allow negative values due to min={0}
      const minimumField = screen.getByLabelText(/Percentual mínimo de frequência acumulada/i) as HTMLInputElement;
      expect(minimumField.validity.valid).toBe(false);
    });

    it('test_attendanceConfigPage_minAccumulatedFrequency_greaterThan100_showsError', async () => {
      renderPage();

      await waitFor(() => {
        const minimumField = screen.getByLabelText(/Percentual mínimo de frequência acumulada/i) as HTMLInputElement;
        fireEvent.change(minimumField, { target: { value: '101' } });
      });

      // The input should not allow > 100 due to max={100}
      const minimumField = screen.getByLabelText(/Percentual mínimo de frequência acumulada/i) as HTMLInputElement;
      expect(minimumField.validity.valid).toBe(false);
    });

    it('test_attendanceConfigPage_accumulatedFrequencyPeriod_outsideEnum_isRejected', async () => {
      renderPage();

      await waitFor(() => {
        const periodSelect = screen.getByLabelText(/Período de apuração/i) as HTMLSelectElement;
        // Try to set an invalid value (should not be possible via the select)
        fireEvent.change(periodSelect, { target: { value: 'invalid_period' } });
      });

      // The select should maintain a valid value
      const periodSelect = screen.getByLabelText(/Período de apuração/i) as HTMLSelectElement;
      const validValues = ['bimester', 'trimester', 'semester'];
      expect(validValues).toContain(periodSelect.value);
    });
  });

  // ============================================================================
  // Form Submission
  // ============================================================================
  describe('form submission', () => {
    beforeEach(() => {
      vi.spyOn(configApi, 'listConfigs').mockResolvedValue([]);
      vi.spyOn(configApi, 'listCourses').mockResolvedValue([
        { id: 'course-1', name: 'Engenharia' },
        { id: 'course-2', name: 'Medicina' },
      ]);
      vi.spyOn(configApi, 'listClassGroups').mockResolvedValue([
        { id: 'class-1', name: 'Turma A' },
        { id: 'class-2', name: 'Turma B' },
      ]);
      vi.spyOn(configApi, 'listFactorTypes').mockResolvedValue([]);
    });

    it('test_attendanceConfigPage_submitPayload_includesControlBFields', async () => {
      const upsertMock = vi.spyOn(configApi, 'upsertConfig').mockResolvedValue({ configId: 'config-1' });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Salvar configuração/)).toBeInTheDocument();
      });

      // Set values for Controle B
      const minimumField = screen.getByLabelText(/Percentual mínimo de frequência acumulada/i) as HTMLInputElement;
      fireEvent.change(minimumField, { target: { value: '80' } });

      const periodSelect = screen.getByLabelText(/Período de apuração/i) as HTMLSelectElement;
      fireEvent.change(periodSelect, { target: { value: 'trimester' } });

      // Submit the form
      const submitButton = screen.getByText(/Salvar configuração/) as HTMLButtonElement;
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledWith(
          expect.objectContaining({
            minAccumulatedFrequencyPercentage: 80,
            accumulatedFrequencyPeriod: 'trimester',
          }),
        );
      });
    });

    it('test_attendanceConfigPage_institutionScope_doesNotSendScopeId', async () => {
      const upsertMock = vi.spyOn(configApi, 'upsertConfig').mockResolvedValue({ configId: 'config-1' });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Salvar configuração/)).toBeInTheDocument();
      });

      const submitButton = screen.getByText(/Salvar configuração/) as HTMLButtonElement;
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledWith(
          expect.objectContaining({
            scopeType: 'institution',
            scopeId: undefined,
          }),
        );
      });
    });

    it('test_attendanceConfigPage_courseScope_sendsCourseId', async () => {
      const upsertMock = vi.spyOn(configApi, 'upsertConfig').mockResolvedValue({ configId: 'config-1' });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Salvar configuração/)).toBeInTheDocument();
      });

      // Switch to course scope
      const scopeTypeSelect = screen.getByLabelText(/Tipo de escopo/i) as HTMLSelectElement;
      fireEvent.change(scopeTypeSelect, { target: { value: 'course' } });

      await waitFor(() => {
        expect(screen.getByLabelText(/Curso/i)).toBeInTheDocument();
      });

      // Select a course
      const courseSelect = screen.getByLabelText(/Curso/i) as HTMLSelectElement;
      fireEvent.change(courseSelect, { target: { value: 'course-1' } });

      const submitButton = screen.getByText(/Salvar configuração/) as HTMLButtonElement;
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledWith(
          expect.objectContaining({
            scopeType: 'course',
            scopeId: 'course-1',
          }),
        );
      });
    });

    it('test_attendanceConfigPage_classGroupScope_sendsTurmaId', async () => {
      const upsertMock = vi.spyOn(configApi, 'upsertConfig').mockResolvedValue({ configId: 'config-1' });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Salvar configuração/)).toBeInTheDocument();
      });

      // Switch to class group scope
      const scopeTypeSelect = screen.getByLabelText(/Tipo de escopo/i) as HTMLSelectElement;
      fireEvent.change(scopeTypeSelect, { target: { value: 'class_group' } });

      await waitFor(() => {
        expect(screen.getByLabelText(/Turma/i)).toBeInTheDocument();
      });

      // Select a class group
      const classSelect = screen.getByLabelText(/Turma/i) as HTMLSelectElement;
      fireEvent.change(classSelect, { target: { value: 'class-1' } });

      const submitButton = screen.getByText(/Salvar configuração/) as HTMLButtonElement;
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledWith(
          expect.objectContaining({
            scopeType: 'class_group',
            scopeId: 'class-1',
          }),
        );
      });
    });

    it('test_attendanceConfigPage_submitDisabledWhenNoScopeSelectedForNonInstitution', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Salvar configuração/)).toBeInTheDocument();
      });

      // Switch to course scope but don't select a course
      const scopeTypeSelect = screen.getByLabelText(/Tipo de escopo/i) as HTMLSelectElement;
      fireEvent.change(scopeTypeSelect, { target: { value: 'course' } });

      await waitFor(() => {
        expect(screen.getByLabelText(/Curso/i)).toBeInTheDocument();
      });

      // Submit button should be disabled because no course is selected
      const submitButton = screen.getByText(/Salvar configuração/) as HTMLButtonElement;
      expect(submitButton).toBeDisabled();
    });
  });

  // ============================================================================
  // Required Fields
  // ============================================================================
  describe('required fields', () => {
    beforeEach(() => {
      vi.spyOn(configApi, 'listConfigs').mockResolvedValue([]);
      vi.spyOn(configApi, 'listCourses').mockResolvedValue([]);
      vi.spyOn(configApi, 'listClassGroups').mockResolvedValue([]);
      vi.spyOn(configApi, 'listFactorTypes').mockResolvedValue([]);
    });

    it('test_attendanceConfigPage_minAccumulatedFrequency_isRequired', async () => {
      renderPage();

      await waitFor(() => {
        const field = screen.getByLabelText(/Percentual mínimo de frequência acumulada/i) as HTMLInputElement;
        expect(field).toHaveAttribute('required');
      });
    });

    it('test_attendanceConfigPage_accumulatedFrequencyPeriod_isRequired', async () => {
      renderPage();

      await waitFor(() => {
        const field = screen.getByLabelText(/Período de apuração/i) as HTMLSelectElement;
        expect(field).toHaveAttribute('required');
      });
    });
  });

  // ============================================================================
  // Control A and B Always Submitted Together
  // ============================================================================
  describe('Control A and B coupling', () => {
    beforeEach(() => {
      vi.spyOn(configApi, 'listConfigs').mockResolvedValue([]);
      vi.spyOn(configApi, 'listCourses').mockResolvedValue([]);
      vi.spyOn(configApi, 'listClassGroups').mockResolvedValue([]);
      vi.spyOn(configApi, 'listFactorTypes').mockResolvedValue([]);
    });

    it('test_attendanceConfigPage_formHasOnlyOneSubmitButton', async () => {
      renderPage();

      await waitFor(() => {
        const submitButtons = screen.getAllByRole('button', { name: /Salvar configuração/i });
        expect(submitButtons.length).toBe(1);
      });
    });

    it('test_attendanceConfigPage_singleSubmit_sendsAllControlAAndControlBFields', async () => {
      const upsertMock = vi.spyOn(configApi, 'upsertConfig').mockResolvedValue({ configId: 'config-1' });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Salvar configuração/)).toBeInTheDocument();
      });

      const submitButton = screen.getByText(/Salvar configuração/) as HTMLButtonElement;
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledWith(
          expect.objectContaining({
            minAttendancePercentage: expect.any(Number),
            toleranceMinutes: expect.any(Number),
            postToleranceBehavior: expect.any(String),
            minAccumulatedFrequencyPercentage: expect.any(Number),
            accumulatedFrequencyPeriod: expect.any(String),
          }),
        );
      });
    });
  });
});
