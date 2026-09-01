import styles from './data-table.module.css';

export interface DataTableColumn<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
}

// Deliberately no sorting/pagination/filtering — out of scope for this
// internal tool per the brief (minimal, functional tables, no design
// system). Add those only if a real screen needs them.
export function DataTable<T>({ rows, columns, getRowKey, emptyMessage = 'Nenhum registro ainda.' }: DataTableProps<T>) {
  if (rows.length === 0) {
    return <p>{emptyMessage}</p>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.header}>{column.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={getRowKey(row)}>
            {columns.map((column) => (
              <td key={column.header}>{column.cell(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
