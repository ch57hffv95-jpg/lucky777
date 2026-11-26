<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LUCKY 777 BIZ PRO — 可用淨現金與待收結算</title>
  <style>
    :root {
      --bg: #0f1117;
      --card: #181b24;
      --border: #2a2f3d;
      --text: #f3f4f6;
      --muted: #9ca3af;
      --accent: #22c55e;
      --warn: #f59e0b;
      --btn: #2563eb;
      --btn-hover: #1d4ed8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang TC", "Noto Sans TC", sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    .container { max-width: 960px; margin: 0 auto; }
    h1 { font-size: 1.35rem; margin: 0 0 16px; }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 14px;
      margin-bottom: 20px;
    }
    .box {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
    }
    .label { font-size: 0.85rem; color: var(--muted); margin-bottom: 6px; }
    .amount { font-size: 1.7rem; font-weight: 700; }
    .cash { color: var(--accent); }
    .pending { color: var(--warn); }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 20px;
    }
    th, td {
      padding: 12px 14px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      font-size: 0.92rem;
    }
    th { color: var(--muted); font-weight: 600; background: #13161e; }
    tr:last-child td { border-bottom: none; }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 600;
    }
    .badge-pending { background: rgba(245, 158, 11, 0.16); color: var(--warn); }
    .badge-done { background: rgba(34, 197, 94, 0.16); color: var(--accent); }
    button {
      background: var(--btn);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: var(--btn-hover); }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    .form-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
    }
    input {
      background: #11141c;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 0.9rem;
    }
    .log-item {
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
      font-size: 0.88rem;
      color: var(--muted);
    }
    .log-item:last-child { border-bottom: none; }
    .log-item strong { color: var(--text); }
  </style>
</head>
<body>
  <div class="container">
    <h1>LUCKY 777 BIZ PRO — 可用淨現金 &amp; 待收結算</h1>

    <!-- 頂部資金總覽雙欄 -->
    <div class="grid-2">
      <div class="box">
        <div class="label">可用淨現金（Available Net Cash — 已到賬）</div>
        <div id="availableCashDisplay" class="amount cash">HK$80,000</div>
      </div>
      <div class="box">
        <div class="label">未到賬款項 / 待收鋪頭款項（Pending Payout）</div>
        <div id="pendingPayoutDisplay" class="amount pending">HK$0</div>
      </div>
    </div>

    <!-- 新增待收鋪頭/池結算紀錄 -->
    <div class="box" style="margin-bottom: 20px;">
      <div class="label">新增已完鋪 / 已結算但未到賬紀錄</div>
      <div class="form-row">
        <input id="newNameInput" type="text" placeholder="鋪名 / 福袋池（例如：石門潮格 C8）" />
        <input id="newDateInput" type="date" />
        <input id="newAmountInput" type="number" min="1" step="1" placeholder="應收金額 (HK$)" />
        <button id="addSettlementBtn" type="button">加入待收列表</button>
      </div>
    </div>

    <!-- 逐鋪 / 逐池結算列表 -->
    <table>
      <thead>
        <tr>
          <th>鋪名 / 福袋池</th>
          <th>結算日期</th>
          <th>應收金額</th>
          <th>狀態</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody id="settlementsBody"></tbody>
    </table>

    <!-- 已確認收款流水 -->
    <div class="box">
      <div class="label">已確認收款流水紀錄（Payout Logs）</div>
      <div id="payoutLogsList"></div>
    </div>
  </div>

  <script>
    const INITIAL_CASH_STATE = {
      availableNetCash: 80000,
      payoutLogs: []
    };

    const DEFAULT_SETTLEMENTS = [
      {
        id: 'SET_C8_01',
        name: '石門潮格 C8',
        settledDate: '2026-11-26',
        payoutAmount: 0,
        status: 'settled_pending_payout',
        receivedAt: null,
        payoutNote: ''
      },
      {
        id: 'SET_C9_01',
        name: '石門潮格 C9',
        settledDate: '2026-11-26',
        payoutAmount: 0,
        status: 'settled_pending_payout',
        receivedAt: null,
        payoutNote: ''
      },
      {
        id: 'SET_ONE_01',
        name: '大圍 THE ONE CONCEPT',
        settledDate: '2026-11-26',
        payoutAmount: 0,
        status: 'settled_pending_payout',
        receivedAt: null,
        payoutNote: ''
      }
    ];

    function calculatePendingPayout(settlements) {
      return settlements
        .filter((item) => item.status === 'settled_pending_payout')
        .reduce((sum, item) => sum + Number(item.payoutAmount || 0), 0);
    }

    function confirmStorePayout({ cashState, settlements, settlementId, note = '' }) {
      const targetIndex = settlements.findIndex((s) => s.id === settlementId);
      if (targetIndex === -1) throw new Error(`找不到結算紀錄：${settlementId}`);

      const target = settlements[targetIndex];
      if (target.status !== 'settled_pending_payout') {
        throw new Error(`此紀錄唔係「未到賬」狀態（現況：${target.status}）`);
      }

      const amount = Number(target.payoutAmount || 0);
      if (amount <= 0) throw new Error(`應收金額必須大於 HK$0`);

      const nowIso = new Date().toISOString();
      const prevCash = Number(cashState.availableNetCash || 0);
      const nextCash = prevCash + amount;

      const updatedItem = {
        ...target,
        status: 'payout_received',
        receivedAt: nowIso,
        payoutNote: note || target.payoutNote || ''
      };

      const updatedSettlements = settlements.map((item, idx) =>
        idx === targetIndex ? updatedItem : item
      );

      const logEntry = {
        id: `PAYOUT_${Date.now()}_${settlementId}`,
        settlementId: target.id,
        storeOrPoolName: target.name,
        amount,
        previousAvailableNetCash: prevCash,
        newAvailableNetCash: nextCash,
        receivedAt: nowIso,
        note
      };

      const updatedCashState = {
        ...cashState,
        availableNetCash: nextCash,
        payoutLogs: [logEntry, ...(cashState.payoutLogs || [])]
      };

      return {
        cashState: updatedCashState,
        settlements: updatedSettlements,
        receivedItem: updatedItem
      };
    }

    // IndexedDB 儲存層
    const DB_NAME = 'Lucky777CashDB';
    const DB_VERSION = 1;

    function openCashDB() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('cashState')) {
            db.createObjectStore('cashState', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('settlements')) {
            db.createObjectStore('settlements', { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    async function loadFromIDB(db) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['cashState', 'settlements'], 'readonly');
        const cashReq = tx.objectStore('cashState').get('main');
        const setReq = tx.objectStore('settlements').getAll();

        tx.oncomplete = () => {
          resolve({
            cashState: cashReq.result
              ? {
                  availableNetCash: Number(cashReq.result.availableNetCash ?? 80000),
                  payoutLogs: cashReq.result.payoutLogs || []
                }
              : { ...INITIAL_CASH_STATE },
            settlements:
              setReq.result && setReq.result.length > 0
                ? setReq.result
                : DEFAULT_SETTLEMENTS
          });
        };
        tx.onerror = () => reject(tx.error);
      });
    }

    async function saveAllToIDB(db, cashState, settlements) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['cashState', 'settlements'], 'readwrite');
        tx.objectStore('cashState').put({ key: 'main', ...cashState });
        const store = tx.objectStore('settlements');
        store.clear();
        settlements.forEach((s) => store.put(s));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    }

    const fmtHKD = (n) => `HK$${Number(n || 0).toLocaleString('en-HK')}`;

    let dbInstance = null;
    let state = {
      cashState: { ...INITIAL_CASH_STATE },
      settlements: [...DEFAULT_SETTLEMENTS]
    };

    function renderUI() {
      const pendingTotal = calculatePendingPayout(state.settlements);
      document.getElementById('availableCashDisplay').textContent = fmtHKD(
        state.cashState.availableNetCash
      );
      document.getElementById('pendingPayoutDisplay').textContent = fmtHKD(pendingTotal);

      const tbody = document.getElementById('settlementsBody');
      tbody.innerHTML = '';

      state.settlements.forEach((item) => {
        const tr = document.createElement('tr');
        const isPending = item.status === 'settled_pending_payout';
        tr.innerHTML = `
          <td><strong>${item.name}</strong></td>
          <td>${item.settledDate || '-'}</td>
          <td>${fmtHKD(item.payoutAmount)}</td>
          <td>
            <span class="badge ${isPending ? 'badge-pending' : 'badge-done'}">
              ${isPending ? '未到賬（待收款）' : '已到賬'}
            </span>
          </td>
          <td>
            <button type="button" ${!isPending || Number(item.payoutAmount) <= 0 ? 'disabled' : ''} data-id="${item.id}">
              確認已收款
            </button>
          </td>
        `;
        const btn = tr.querySelector('button');
        if (btn) {
          btn.addEventListener('click', async () => {
            const expectedNextCash =
              Number(state.cashState.availableNetCash || 0) + Number(item.payoutAmount || 0);
            const ok = window.confirm(
              `確認收到「${item.name}」款項 ${fmtHKD(item.payoutAmount)} 並轉入可用淨現金？\n收款後可用淨現金將變為：${fmtHKD(expectedNextCash)}`
            );
            if (!ok) return;

            try {
              const result = confirmStorePayout({
                cashState: state.cashState,
                settlements: state.settlements,
                settlementId: item.id
              });
              state.cashState = result.cashState;
              state.settlements = result.settlements;
              if (dbInstance) {
                await saveAllToIDB(dbInstance, state.cashState, state.settlements);
              }
              renderUI();
            } catch (err) {
              alert(err.message);
            }
          });
        }
        tbody.appendChild(tr);
      });

      const logsEl = document.getElementById('payoutLogsList');
      const logs = state.cashState.payoutLogs || [];
      if (logs.length === 0) {
        logsEl.innerHTML = '<div class="log-item">暫時未有已確認收款紀錄。</div>';
      } else {
        logsEl.innerHTML = logs
          .map(
            (l) => `
          <div class="log-item">
            <strong>${l.storeOrPoolName}</strong> 收款 <strong>${fmtHKD(l.amount)}</strong>
            （可用淨現金：${fmtHKD(l.previousAvailableNetCash)} → <strong>${fmtHKD(l.newAvailableNetCash)}</strong>）
            · ${new Date(l.receivedAt).toLocaleString('zh-HK')}
          </div>
        `
          )
          .join('');
      }
    }

    document.getElementById('newDateInput').value = new Date().toISOString().slice(0, 10);

    document.getElementById('addSettlementBtn').addEventListener('click', async () => {
      const name = document.getElementById('newNameInput').value.trim();
      const settledDate = document.getElementById('newDateInput').value;
      const payoutAmount = Number(document.getElementById('newAmountInput').value);

      if (!name) return alert('請輸入鋪名或福袋池名稱');
      if (!payoutAmount || payoutAmount <= 0) return alert('請輸入大於 0 嘅應收金額');

      const newRecord = {
        id: `SET_${Date.now()}`,
        name,
        settledDate,
        payoutAmount,
        status: 'settled_pending_payout',
        receivedAt: null,
        payoutNote: ''
      };

      state.settlements = [newRecord, ...state.settlements];
      if (dbInstance) {
        await saveAllToIDB(dbInstance, state.cashState, state.settlements);
      }
      document.getElementById('newNameInput').value = '';
      document.getElementById('newAmountInput').value = '';
      renderUI();
    });

    (async function init() {
      try {
        dbInstance = await openCashDB();
        state = await loadFromIDB(dbInstance);
      } catch (e) {
        console.warn('IndexedDB 初始化 fallback 至記憶體狀態：', e);
      }
      renderUI();
    })();
  </script>
</body>
</html>
