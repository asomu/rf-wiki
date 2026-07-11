import { useRef, useState, type KeyboardEvent } from 'react';
import NetworkLab from './NetworkLab';
import SmithLab from './SmithLab';

type View = 'one-port' | 'two-port';

export default function VnaSmithLab() {
  const [view, setView] = useState<View>('one-port');
  const [visited, setVisited] = useState<Record<View, boolean>>({ 'one-port': true, 'two-port': false });
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const views: readonly View[] = ['one-port', 'two-port'];

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
      <div className="simulator-switcher__tabs" role="tablist" aria-label="VNA one-port와 two-port 실험 선택">
        <button ref={(node) => { tabRefs.current[0] = node; }} type="button" role="tab" id="vna-one-port-tab" aria-selected={view === 'one-port'} aria-controls="vna-one-port-panel" tabIndex={view === 'one-port' ? 0 : -1} onClick={() => activateView('one-port')} onKeyDown={(event) => handleTabKey(event, 0)}>
          1-port · Γ / VSWR
        </button>
        <button ref={(node) => { tabRefs.current[1] = node; }} type="button" role="tab" id="vna-two-port-tab" aria-selected={view === 'two-port'} aria-controls="vna-two-port-panel" tabIndex={view === 'two-port' ? 0 : -1} onClick={() => activateView('two-port')} onKeyDown={(event) => handleTabKey(event, 1)}>
          2-port · gain / stability
        </button>
      </div>
      <div id="vna-one-port-panel" role="tabpanel" aria-labelledby="vna-one-port-tab" hidden={view !== 'one-port'}>
        {visited['one-port'] && <SmithLab />}
      </div>
      <div id="vna-two-port-panel" role="tabpanel" aria-labelledby="vna-two-port-tab" hidden={view !== 'two-port'}>
        {visited['two-port'] && <NetworkLab />}
      </div>
    </div>
  );
}
