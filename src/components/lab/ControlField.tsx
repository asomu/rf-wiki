import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { useLabControlInteraction } from './LabControlInteraction';

function describedBy(existing: string | undefined, ...ids: (string | false | undefined)[]) {
  return [existing, ...ids.filter(Boolean)].filter(Boolean).join(' ') || undefined;
}

interface RangeProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id: string;
  label: string;
  valueText: string;
  help?: string;
}

export function RangeControl({ label, valueText, help, id, onChange, ...props }: RangeProps) {
  const reportInteraction = useLabControlInteraction();
  const helpId = help ? `${id}-help` : undefined;

  return (
    <div className="control-field">
      <div className="control-field__label">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{valueText}</output>
      </div>
      <input
        id={id}
        type="range"
        {...props}
        name={props.name ?? id}
        aria-valuetext={props['aria-valuetext'] ?? valueText}
        aria-describedby={describedBy(props['aria-describedby'], helpId)}
        onChange={(event) => {
          onChange?.(event);
          reportInteraction(id);
        }}
      />
      {help && <p id={helpId}>{help}</p>}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  label: string;
  help?: string;
}

export function SelectControl({ label, help, id, children, onChange, ...props }: SelectProps) {
  const reportInteraction = useLabControlInteraction();
  const helpId = help ? `${id}-help` : undefined;

  return (
    <div className="control-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        {...props}
        name={props.name ?? id}
        aria-describedby={describedBy(props['aria-describedby'], helpId)}
        onChange={(event) => {
          onChange?.(event);
          reportInteraction(id);
        }}
      >
        {children}
      </select>
      {help && <p id={helpId}>{help}</p>}
    </div>
  );
}

interface NumberProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id: string;
  label: string;
  unit: string;
  help?: string;
}

export function NumberControl({ label, unit, help, id, onChange, ...props }: NumberProps) {
  const reportInteraction = useLabControlInteraction();
  const helpId = help ? `${id}-help` : undefined;
  const unitId = `${id}-unit`;
  const displayedValue = props.value ?? props.defaultValue;

  return (
    <div className="control-field">
      <label htmlFor={id}>{label}</label>
      <div className="control-field__number">
        <input
          id={id}
          type="number"
          {...props}
          name={props.name ?? id}
          aria-valuetext={props['aria-valuetext'] ?? (displayedValue === undefined ? undefined : `${displayedValue} ${unit}`)}
          aria-describedby={describedBy(props['aria-describedby'], unitId, helpId)}
          onChange={(event) => {
            onChange?.(event);
            reportInteraction(id);
          }}
        />
        <span id={unitId}>{unit}</span>
      </div>
      {help && <p id={helpId}>{help}</p>}
    </div>
  );
}
