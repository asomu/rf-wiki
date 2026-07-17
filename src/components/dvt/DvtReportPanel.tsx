import { useId, useState } from 'react';

interface DvtReportPanelProps {
  title: string;
  status: string;
  summary: string;
  conclusion: string;
  rows: readonly {
    label: string;
    value: string;
    evidence: string;
  }[];
}

type DvtReportTone = 'forward' | 'reference' | 'reverse';

function reportTone(status: string): DvtReportTone {
  const normalized = status.trim().toUpperCase();
  if (['READY', 'PASS', 'VALID'].includes(normalized)) return 'forward';
  if (['BLOCKED', 'INVALID', 'FAIL'].includes(normalized)) return 'reverse';
  return 'reference';
}

export function DvtReportPanel({
  title,
  status,
  summary,
  conclusion,
  rows,
}: DvtReportPanelProps) {
  const id = useId();
  const tone = reportTone(status);
  const [copyStatus, setCopyStatus] = useState('결론을 선택하거나 복사할 수 있습니다.');

  async function copyConclusion() {
    if (!navigator.clipboard) {
      setCopyStatus('자동 복사를 사용할 수 없습니다. 아래 결론을 직접 선택하세요.');
      return;
    }
    try {
      await navigator.clipboard.writeText(conclusion);
      setCopyStatus('결론을 클립보드에 복사했습니다.');
    } catch {
      setCopyStatus('자동 복사를 사용할 수 없습니다. 아래 결론을 직접 선택하세요.');
    }
  }

  return (
    <article className="dvt-report" aria-labelledby={`${id}-title`}>
      <header>
        <div>
          <p>Validator 범위의 구조화된 HTML report</p>
          <h3 id={`${id}-title`}>{title}</h3>
        </div>
        <strong data-status={status.trim().toUpperCase()} data-tone={tone}>{status}</strong>
      </header>
      <p className="dvt-report__summary">{summary}</p>
      <div className="dvt-report__table" tabIndex={0} role="region" aria-label={`${title} 근거 표`}>
        <table>
          <caption>{title} 근거</caption>
          <thead>
            <tr><th>항목</th><th>판정값</th><th>근거</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.value}</td>
                <td>{row.evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="dvt-report__conclusion">
        <label htmlFor={`${id}-conclusion`}>Copyable engineering conclusion</label>
        <textarea
          id={`${id}-conclusion`}
          rows={5}
          readOnly
          value={conclusion}
          onFocus={(event) => event.currentTarget.select()}
        />
        <button type="button" className="lab-button lab-button--secondary" onClick={copyConclusion}>
          결론 복사
        </button>
        <p role="status" aria-live="polite">{copyStatus}</p>
      </div>
    </article>
  );
}
