import { useId, type ReactNode } from 'react';

interface Props {
  title: string;
  observation: string;
  children: ReactNode;
  table?: ReactNode;
  actions?: ReactNode;
}

export function PlotFrame({ title, observation, children, table, actions }: Props) {
  const id = useId();
  return (
    <section className="plot-frame" aria-labelledby={`${id}-title`}>
      <header>
        <div>
          <h3 id={`${id}-title`}>{title}</h3>
          <p>{observation}</p>
        </div>
        {actions}
      </header>
      <div className="plot-frame__canvas">{children}</div>
      {table && (
        <details className="plot-frame__table">
          <summary>그래프 값을 표로 보기</summary>
          {table}
        </details>
      )}
    </section>
  );
}
