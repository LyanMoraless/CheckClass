import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { listPersons } from '../features/users/users-api';

interface PersonIdFieldProps {
  label: string;
  value: string;
  onChange: (personId: string) => void;
  required?: boolean;
}

// GET /v1/users (person lookup) is gated MANAGE_USERS, but personId is
// needed by screens gated on other permissions too (enrollment, wristband
// issue). retry: false + isError-tolerant rendering means a 403 here just
// falls back to plain manual id entry instead of breaking the form.
export function PersonIdField({ label, value, onChange, required }: PersonIdFieldProps) {
  const listId = useId();
  const { data: persons } = useQuery({
    queryKey: ['persons'],
    queryFn: listPersons,
    retry: false,
    staleTime: 60_000,
  });

  return (
    <label>
      {label}
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder="Person ID (UUID)"
        list={persons && persons.length > 0 ? listId : undefined}
      />
      {persons && persons.length > 0 && (
        <datalist id={listId}>
          {persons.map((person) => (
            <option key={person.personId} value={person.personId}>
              {person.fullName} ({person.actorTypeCode})
            </option>
          ))}
        </datalist>
      )}
      {!persons && <small>Type the person's ID directly if the lookup list isn't available to you.</small>}
    </label>
  );
}
