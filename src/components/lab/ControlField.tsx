import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { useLabControlInteraction } from './LabControlInteraction';

interface RangeProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id: string;
  label: string;
  valueText: string;
  help?: string;
}

export function RangeControl({ label, valueText, help, id, onChange, ...props }: RangeProps) {
  const reportInteraction = useLabControlInteraction();

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
        onChange={(event) => {
          onChange?.(event);
          reportInteraction(id);
        }}
      />
      {help && <p>{help}</p>}
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

  return (
    <div className="control-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        {...props}
        onChange={(event) => {
          onChange?.(event);
          reportInteraction(id);
        }}
      >
        {children}
      </select>
      {help && <p>{help}</p>}
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

  return (
    <div className="control-field">
      <label htmlFor={id}>{label}</label>
      <div className="control-field__number">
        <input
          id={id}
          type="number"
          {...props}
          onChange={(event) => {
            onChange?.(event);
            reportInteraction(id);
          }}
        />
        <span>{unit}</span>
      </div>
      {help && <p>{help}</p>}
    </div>
  );
}
