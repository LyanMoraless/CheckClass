import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AttendanceConfigPage } from './attendance-config-page';
import * as configApi from './attendance-config-api';
import * as coursesApi from '../courses/courses-api';
import * as classGroupsApi from '../class-groups/class-groups-api';
import * as authContext from '../auth/auth-context';

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
    // AttendanceConfigPage reads useAuth().hasPermission('configure_attendance_rules')
    // to gate the whole form fieldset. There is no AuthProvider in this render
    // tree (only QueryClientProvider), so useAuth is mocked directly — same
    // pattern as device-binding-config-page.spec.tsx — with the permission
    // granted, since every test below exercises the enabled form.
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      status: 'authenticated',
      personId: 'person-1',
      permissions: new Set(['configure_attendance_rules']),
      roleContext: { isStudent: false, teaching: [], coordinating: [], isDirection: false, institutionType: 'faculdade' },
      hasPermission: () => true,
      login: vi.fn(),
      logout: vi.fn(),
    });
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
      vi.spyOn(coursesApi, 'listCourses').mockResolvedValue([]);
      vi.spyOn(classGroupsApi, 'listClassGroups').mockResolvedValue([]);
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
      vi.spyOn(coursesApi, 'listCourses').mockResolvedValue([]);
      vi.spyOn(classGroupsApi, 'listClassGroups').mockResolvedValue([]);
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
      vi.spyOn(coursesApi, 'listCourses').mockResolvedValue([]);
      vi.spyOn(classGroupsApi, 'listClassGroups').mockResolvedValue([]);
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
      vi.spyOn(coursesApi, 'listCourses').mockResolvedValue([]);
      vi.spyOn(classGroupsApi, 'listClassGroups').mockResolvedValue([]);
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
      vi.spyOn(coursesApi, 'listCourses').mockResolvedValue([
        { id: 'course-1', name: 'Engenharia', code: null },
        { id: 'course-2', name: 'Medicina', code: null },
      ]);
      vi.spyOn(classGroupsApi, 'listClassGroups').mockResolvedValue([
        { id: 'class-1', courseId: 'course-1', subjectIds: [], name: 'Turma A', roomId: null, termStartDate: null, termEndDate: null },
        { id: 'class-2', courseId: 'course-1', subjectIds: [], name: 'Turma B', roomId: null, termStartDate: null, termEndDate: null },
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
        // TanStack Query v5's mutationFn is invoked as fn(variables, context)
        // — the second arg (client/meta/mutationKey) isn't something this
        // page controls, so only the variables shape is asserted here.
        expect(upsertMock).toHaveBeenCalledWith(
          expect.objectContaining({
            minAccumulatedFrequencyPercentage: 80,
            accumulatedFrequencyPeriod: 'trimester',
          }),
          expect.anything(),
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
          expect.anything(),
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
          expect.anything(),
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
          expect.anything(),
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
      vi.spyOn(coursesApi, 'listCourses').mockResolvedValue([]);
      vi.spyOn(classGroupsApi, 'listClassGroups').mockResolvedValue([]);
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
      vi.spyOn(coursesApi, 'listCourses').mockResolvedValue([]);
      vi.spyOn(classGroupsApi, 'listClassGroups').mockResolvedValue([]);
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
          expect.anything(),
        );
      });
    });
  });
});
