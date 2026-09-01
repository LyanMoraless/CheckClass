import type { ComponentType, ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';
import styles from './page-header.module.css';

export type PageArea = 'core' | 'registry' | 'settings' | 'security';

interface PageHeaderProps {
  icon: ComponentType<LucideProps>;
  title: string;
  description?: string;
  area: PageArea;
  actions?: ReactNode;
}

// Every feature page opens with one of these — the icon's soft-tinted tile
// uses the same area color as this page's nav group (see app-shell.tsx's
// AREA_COLORS), so "which part of the app am I in" is answerable without
// reading the sidebar.
export function PageHeader({ icon: Icon, title, description, area, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={`${styles.iconTile} ${styles[area]}`}>
        <Icon size={20} strokeWidth={2} />
      </div>
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
