import { useRef, useState, type KeyboardEvent } from 'react';
import IQLab from './IQLab';
import SpectrumLab from './SpectrumLab';
import { useLinkedSignalState } from './useLinkedSignalState';

type View = 'spectrum' | 'iq';

export default function SpectrumIQLab() {
  const [view, setView] = useState<View>('spectrum');
  const [visited, setVisited] = useState<Record<View, boolean>>({ spectrum: true, iq: false });
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const signal = useLinkedSignalState();
  const views: readonly View[] = ['spectrum', 'iq'];

  function activateView(nextView: View) {
    setView(nextView);
    setVisited((current) => current[nextView]
      ? current
      : { ...current, [nextView]: true });
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % views.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + views.length) % views.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = views.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    activateView(views[nextIndex]!);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="simulator-switcher">
      <div className="simulator-switcher__tabs" role="tablist" aria-label="SA와 IQ 실험 선택">
        <button
          ref={(node) => { tabRefs.current[0] = node; }}
          type="button"
          role="tab"
          aria-selected={view === 'spectrum'}
          tabIndex={view === 'spectrum' ? 0 : -1}
          aria-controls="spectrum-lab-panel"
          id="spectrum-lab-tab"
          onClick={() => activateView('spectrum')}
          onKeyDown={(event) => handleTabKey(event, 0)}
        >
          SA trace
        </button>
        <button
          ref={(node) => { tabRefs.current[1] = node; }}
          type="button"
          role="tab"
          aria-selected={view === 'iq'}
          tabIndex={view === 'iq' ? 0 : -1}
          aria-controls="iq-lab-panel"
          id="iq-lab-tab"
          onClick={() => activateView('iq')}
          onKeyDown={(event) => handleTabKey(event, 1)}
        >
          IQ capture
        </button>
      </div>
      <div
        id="spectrum-lab-panel"
        role="tabpanel"
        aria-labelledby="spectrum-lab-tab"
        hidden={view !== 'spectrum'}
      >
        {visited.spectrum && <SpectrumLab signal={signal} />}
      </div>
      <div
        id="iq-lab-panel"
        role="tabpanel"
        aria-labelledby="iq-lab-tab"
        hidden={view !== 'iq'}
      >
        {visited.iq && <IQLab signal={signal} />}
      </div>
    </div>
  );
}
