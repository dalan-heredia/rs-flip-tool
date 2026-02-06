// apps/web/src/App.tsx
import { useEffect, useMemo, useState } from 'react';
import './App.css';

type Health = {
  ok: boolean;
  service?: string;
  version?: string;
  uptimeSec?: number;
  schemaVersion?: number;
  endpoints?: string[];
};

type WsEnvelope<TType extends string, TPayload> = {
  schemaVersion: number;
  ts: number;
  type: TType;
  payload: TPayload;
};

type FlipRec = {
  itemId: number;
  itemName: string;

  buyPrice: number;
  sellPrice: number;
  quantity: number;

  profitPerUnit: number;
  totalProfit: number;

  estBuyMin: number; // estimated minutes for buy to fill
  estSellMin: number; // estimated minutes for sell to fill

  thinVol5m: number;
  breakoutScore: number;
  score: number;

  eligible?: boolean; // true if meets all strict constraints
  notes?: string | string[]; // why it’s ineligible / confirmations / etc.
};

type FlipsUpdatePayload = {
  params?: Record<string, unknown>;
  recommendations: FlipRec[];
};

type FlipsUpdateMsg = WsEnvelope<'flips:update', FlipsUpdatePayload>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isFlipsUpdateMsg(v: unknown): v is FlipsUpdateMsg {
  if (!isRecord(v)) return false;
  if (v.type !== 'flips:update') return false;
  if (!isRecord(v.payload)) return false;
  const recs = (v.payload as Record<string, unknown>).recommendations;
  return Array.isArray(recs);
}

function fmtNotes(notes: FlipRec['notes']): string {
  if (!notes) return '';
  return Array.isArray(notes) ? notes.join(' • ') : notes;
}

type SortKey =
  | 'eligible'
  | 'itemName'
  | 'buyPrice'
  | 'sellPrice'
  | 'quantity'
  | 'profitPerUnit'
  | 'totalProfit'
  | 'estBuyMin'
  | 'estSellMin'
  | 'thinVol5m'
  | 'breakoutScore'
  | 'score';

export default function App() {
  const API = useMemo<string>(
    () => (import.meta.env.VITE_API_BASE_URL as string) ?? 'http://127.0.0.1:8787',
    [],
  );
  const WS_URL = useMemo<string>(
    () => (import.meta.env.VITE_WS_URL as string) ?? 'ws://127.0.0.1:8787/ws',
    [],
  );

  // --- state declarations (these are the ones we kept talking about) ---
  const [health, setHealth] = useState<Health | null>(null);
  const [healthErr, setHealthErr] = useState<string | null>(null);

  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>(
    'connecting',
  );
  const [lastMsg, setLastMsg] = useState<unknown>(null);

  const [recs, setRecs] = useState<FlipRec[]>([]);
  const [engineParams, setEngineParams] = useState<Record<string, unknown> | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir('desc');
    }
  };

  const sortArrow = (k: SortKey) => {
    if (k !== sortKey) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const sortedRecs = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;

    const get = (r: FlipRec, k: SortKey): string | number => {
      switch (k) {
        case 'eligible':
          return r.eligible ? 1 : 0;
        case 'itemName':
          return r.itemName ?? '';
        default: {
          const val = r[k];
          return typeof val === 'number' ? val : Number(val ?? 0);
        }
      }
    };

    return [...recs].sort((a, b) => {
      const av = get(a, sortKey);
      const bv = get(b, sortKey);
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
      return (Number(av) - Number(bv)) * dir;
    });
  }, [recs, sortKey, sortDir]);

  // Poll API health
  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const r = await fetch(`${API}/api/health`);
        const j = (await r.json()) as Health;
        if (!cancelled) {
          setHealth(j);
          setHealthErr(null);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'health fetch failed';
        if (!cancelled) {
          setHealth(null);
          setHealthErr(msg);
        }
      }
    };

    void tick();
    const id = setInterval(tick, 3000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [API]);

  // WebSocket connect
  useEffect(() => {
    setWsStatus('connecting');
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setWsStatus('connected');
    ws.onclose = () => setWsStatus('disconnected');
    ws.onerror = () => setWsStatus('disconnected');

    ws.onmessage = (event: MessageEvent<string>) => {
      let parsed: unknown = event.data;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        // leave raw string
      }

      setLastMsg(parsed);

      if (isFlipsUpdateMsg(parsed)) {
        setRecs(parsed.payload.recommendations);
        setEngineParams(parsed.payload.params ?? null);
      }
    };

    return () => ws.close();
  }, [WS_URL]);

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: 8,
    borderBottom: '1px solid #ddd',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: 8,
    borderBottom: '1px solid #eee',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ marginTop: 0 }}>RS Flip Tool</h1>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 10, minWidth: 360 }}>
          <h2 style={{ marginTop: 0 }}>API Health</h2>
          {health ? (
            <>
              <div>
                Status: <b style={{ color: 'green' }}>OK</b>
              </div>
              <div>Service: {health.service ?? '(n/a)'}</div>
              <div>Schema: {health.schemaVersion ?? '(n/a)'}</div>
              <div>Endpoints: {(health.endpoints ?? []).join(', ')}</div>
            </>
          ) : (
            <div>
              Status: <b style={{ color: 'crimson' }}>DOWN</b>
              <div style={{ marginTop: 8, color: '#666' }}>{healthErr}</div>
            </div>
          )}
        </div>

        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 10, minWidth: 360 }}>
          <h2 style={{ marginTop: 0 }}>WebSocket</h2>
          <div>
            Status:{' '}
            <b
              style={{
                color:
                  wsStatus === 'connected'
                    ? 'green'
                    : wsStatus === 'connecting'
                      ? 'orange'
                      : 'crimson',
              }}
            >
              {wsStatus}
            </b>
          </div>

          <div style={{ marginTop: 10, marginBottom: 6, color: '#666' }}>
            {isFlipsUpdateMsg(lastMsg)
              ? `flips:update • recs=${(lastMsg.payload?.recommendations ?? []).length}`
              : '—'}
          </div>

          <pre
            style={{
              background: '#f7f7f7',
              color: '#111',
              padding: 10,
              borderRadius: 10,
              overflow: 'auto',
              maxHeight: 260,
              whiteSpace: 'pre-wrap',
              border: '1px solid #ddd',
            }}
          >
            {lastMsg ? JSON.stringify(lastMsg, null, 2) : '(none yet)'}
          </pre>
        </div>
      </div>

      <hr style={{ margin: '24px 0' }} />

      <h2 style={{ marginBottom: 6 }}>Top Flips</h2>
      <div style={{ color: '#666', marginBottom: 12 }}>
        {engineParams ? (
          <>
            Engine params loaded • cash={String(engineParams.cash ?? 'n/a')} • click headers to sort
          </>
        ) : (
          <>Waiting for flips:update…</>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle} onClick={() => toggleSort('eligible')}>
                Eligible{sortArrow('eligible')}
              </th>
              <th style={thStyle} onClick={() => toggleSort('itemName')}>
                Item{sortArrow('itemName')}
              </th>
              <th style={thStyle} onClick={() => toggleSort('buyPrice')}>
                Buy{sortArrow('buyPrice')}
              </th>
              <th style={thStyle} onClick={() => toggleSort('sellPrice')}>
                Sell{sortArrow('sellPrice')}
              </th>
              <th style={thStyle} onClick={() => toggleSort('quantity')}>
                Qty{sortArrow('quantity')}
              </th>
              <th style={thStyle} onClick={() => toggleSort('profitPerUnit')}>
                Profit/u{sortArrow('profitPerUnit')}
              </th>
              <th style={thStyle} onClick={() => toggleSort('totalProfit')}>
                Total{sortArrow('totalProfit')}
              </th>
              <th style={thStyle} onClick={() => toggleSort('estBuyMin')}>
                BuyMin{sortArrow('estBuyMin')}
              </th>
              <th style={thStyle} onClick={() => toggleSort('estSellMin')}>
                SellMin{sortArrow('estSellMin')}
              </th>
              <th style={thStyle} onClick={() => toggleSort('thinVol5m')}>
                Thin5m{sortArrow('thinVol5m')}
              </th>
              <th style={thStyle} onClick={() => toggleSort('breakoutScore')}>
                Breakout{sortArrow('breakoutScore')}
              </th>
              <th style={thStyle} onClick={() => toggleSort('score')}>
                Score{sortArrow('score')}
              </th>
              <th style={{ ...thStyle, cursor: 'default' }}>Notes</th>
            </tr>
          </thead>

          <tbody>
            {sortedRecs.map((r) => (
              <tr key={r.itemId}>
                <td style={tdStyle}>{r.eligible ? '✅' : '⚠️'}</td>
                <td style={tdStyle}>
                  {r.itemName} ({r.itemId})
                </td>
                <td style={tdStyle}>{r.buyPrice.toLocaleString()}</td>
                <td style={tdStyle}>{r.sellPrice.toLocaleString()}</td>
                <td style={tdStyle}>{r.quantity.toLocaleString()}</td>
                <td style={tdStyle}>{r.profitPerUnit.toLocaleString()}</td>
                <td style={tdStyle}>{r.totalProfit.toLocaleString()}</td>
                <td style={tdStyle}>{r.estBuyMin.toFixed(1)}</td>
                <td style={tdStyle}>{r.estSellMin.toFixed(1)}</td>
                <td style={tdStyle}>{r.thinVol5m.toLocaleString()}</td>
                <td style={tdStyle}>{r.breakoutScore.toFixed(1)}</td>
                <td style={tdStyle}>{r.score.toFixed(1)}</td>
                <td style={{ ...tdStyle, color: '#666', whiteSpace: 'normal', maxWidth: 520 }}>
                  {fmtNotes(r.notes)}
                </td>
              </tr>
            ))}

            {sortedRecs.length === 0 ? (
              <tr>
                <td colSpan={13} style={{ padding: 12, color: '#666' }}>
                  No recommendations yet (or the API is not broadcasting flips:update).
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
