// =========================================================================
    // 10. 可用淨現金（HK$80,000 起步）＋ 未到賬款項 ＋ 逐鋪/逐池確認收款
    //     （整合 gemini-code-1795679176875.js 邏輯，保留原有所有功能與界面）
    // =========================================================================
    const INITIAL_CASH_STATE = {
      availableNetCash: 80000, // 可用淨現金（已到賬，起步 HK$80,000）
      payoutLogs: []           // 已確認收款流水紀錄
    };

    const SETTLEMENT_DB_NAME = 'Lucky777SettlementDB';
    const SETTLEMENT_DB_VERSION = 1;

    function calculatePendingPayout(settlements) {
      return (settlements || [])
        .filter((item) => item.status === 'settled_pending_payout')
        .reduce((sum, item) => sum + Number(item.payoutAmount || 0), 0);
    }

    function confirmStorePayout({ cashState, settlements, settlementId, note = '' }) {
      const targetIndex = (settlements || []).findIndex((s) => s.id === settlementId);
      if (targetIndex === -1) {
        throw new Error(`找不到結算紀錄：${settlementId}`);
      }

      const target = settlements[targetIndex];
      if (target.status !== 'settled_pending_payout') {
        throw new Error(`此紀錄唔係「未到賬」狀態（現況：${target.status}）`);
      }

      const amount = Number(target.payoutAmount || 0);
      if (amount <= 0) {
        throw new Error(`應收金額無效：${amount}`);
      }

      const nowIso = new Date().toISOString();
      const prevCash = Number(cashState.availableNetCash || 0);
      const nextCash = prevCash + amount;

      const updatedSettlements = settlements.map((item, idx) =>
        idx === targetIndex
          ? {
              ...item,
              status: 'payout_received',
              receivedAt: nowIso,
              payoutNote: note || item.payoutNote || ''
            }
          : item
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
        receivedItem: updatedSettlements[targetIndex]
      };
    }

    function openSettlementIDB() {
      return new Promise((resolve, reject) => {
        if (!window.indexedDB) return resolve(null);
        const req = indexedDB.open(SETTLEMENT_DB_NAME, SETTLEMENT_DB_VERSION);
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

    async function saveSettlementPayoutToIDB(db, nextCashState, nextSettlements, targetSettlement) {
      if (!db) return false;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['cashState', 'settlements'], 'readwrite');
        tx.objectStore('cashState').put({ key: 'main', ...nextCashState });
        if (targetSettlement) {
          tx.objectStore('settlements').put(targetSettlement);
        }
        if (Array.isArray(nextSettlements)) {
          const sStore = tx.objectStore('settlements');
          nextSettlements.forEach((s) => sStore.put(s));
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    }

    async function loadSettlementStateFromIDB(db) {
      const defaultSettlements = (state.venues || []).map((v) => ({
        id: `SET_${v.id}`,
        name: v.name,
        settledDate: new Date().toISOString().slice(0, 10),
        payoutAmount: 0,
        status: 'settled_pending_payout',
        receivedAt: null,
        payoutNote: ''
      }));

      if (!db) {
        return {
          cashState: { ...INITIAL_CASH_STATE },
          settlements: defaultSettlements
        };
      }

      return new Promise((resolve) => {
        try {
          const tx = db.transaction(['cashState', 'settlements'], 'readonly');
          const cashReq = tx.objectStore('cashState').get('main');
          const setReq = tx.objectStore('settlements').getAll();
          tx.oncomplete = () => {
            const savedCash = cashReq.result;
            const savedSets = setReq.result || [];
            resolve({
              cashState: savedCash
                ? {
                    availableNetCash: Number(savedCash.availableNetCash ?? INITIAL_CASH_STATE.availableNetCash),
                    payoutLogs: Array.isArray(savedCash.payoutLogs) ? savedCash.payoutLogs : []
                  }
                : { ...INITIAL_CASH_STATE },
              settlements: savedSets.length > 0 ? savedSets : defaultSettlements
            });
          };
          tx.onerror = () =>
            resolve({
              cashState: { ...INITIAL_CASH_STATE },
              settlements: defaultSettlements
            });
        } catch (e) {
          resolve({
            cashState: { ...INITIAL_CASH_STATE },
            settlements: defaultSettlements
          });
        }
      });
    }

    let settlementDb = null;
    let settlementModuleState = {
      cashState: { ...INITIAL_CASH_STATE },
      settlements: []
    };

    function ensureSettlementPanelDOM() {
      const anchor = document.getElementById('cashFlowMonitorSection');
      if (!anchor || document.getElementById('netCashSettlementPanel')) return;

      const wrap = document.createElement('div');
      wrap.id = 'netCashSettlementPanel';
      wrap.className = 'mt-4 rounded-2xl border border-emerald-500/30 bg-obsidian p-4 sm:p-5';
      wrap.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-borderline pb-3">
          <div>
            <h3 class="text-sm font-black text-white">💵 可用淨現金 &amp; 未到賬款項（逐鋪／逐池確認收款）</h3>
            <p class="mt-0.5 text-[11px] text-slate-400">未撳「確認已收款」前，鋪頭／福袋池應收款項只會顯示喺「未到賬款項」，確認收款後先會加落「可用淨現金」。</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <div class="num rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs font-black text-emerald-400">
              可用淨現金：<span id="netCashConfirmedVal" class="text-white">HK$ 80,000</span>
            </div>
            <div class="num rounded-xl border border-gold-500/40 bg-gold-500/10 px-3 py-1.5 font-mono text-xs font-black text-gold-400">
              未到賬款項：<span id="pendingPayoutAmountVal" class="text-white">HK$ 0</span>
            </div>
          </div>
        </div>

        <div class="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-12">
          <input id="settleNewName" type="text" placeholder="鋪名 / 福袋池（例如：石門潮格 C8）" class="v-input px-3 py-2 text-xs font-bold sm:col-span-5" />
          <input id="settleNewAmount" type="number" min="1" step="any" placeholder="未到賬應收金額 (HK$)" class="v-input-emerald num px-3 py-2 font-mono text-xs font-bold sm:col-span-3" />
          <input id="settleNewNote" type="text" placeholder="備註（FPS / 銀行 / 現金）" class="v-input px-3 py-2 text-xs sm:col-span-2" />
          <button type="button" onclick="addPendingSettlementItem()" class="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-obsidian hover:bg-emerald-400 sm:col-span-2">+ 加入未到賬</button>
        </div>

        <div id="settlementItemsList" class="mt-3.5 space-y-2"></div>

        <div class="mt-4 border-t border-borderline pt-3">
          <div class="mb-1.5 text-[11px] font-bold text-slate-400">🧾 已確認收款入帳流水</div>
          <div id="settlementPayoutLogs" class="space-y-1.5 text-xs text-slate-300"></div>
        </div>
      `;
      anchor.appendChild(wrap);
    }

    function renderNetCashSettlementPanel() {
      ensureSettlementPanelDOM();
      const cashEl = document.getElementById('netCashConfirmedVal');
      const pendingEl = document.getElementById('pendingPayoutAmountVal');
      const listEl = document.getElementById('settlementItemsList');
      const logsEl = document.getElementById('settlementPayoutLogs');
      if (!cashEl || !pendingEl || !listEl || !logsEl) return;

      const availableCash = Number(settlementModuleState.cashState.availableNetCash ?? 80000);
      const pendingTotal = calculatePendingPayout(settlementModuleState.settlements);

      cashEl.textContent = `HK$ ${availableCash.toLocaleString('en-HK')}`;
      pendingEl.textContent = `HK$ ${pendingTotal.toLocaleString('en-HK')}`;

      const list = settlementModuleState.settlements || [];
      if (list.length === 0) {
        listEl.innerHTML = '<div class="rounded-xl border border-borderline bg-cardbg p-3 text-xs text-slate-400">暫時未有結算紀錄，可於上方新增。</div>';
      } else {
        listEl.innerHTML = list
          .map((item) => {
            const isPending = item.status === 'settled_pending_payout';
            const amt = Number(item.payoutAmount || 0);
            return `
              <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-borderline bg-cardbg px-3.5 py-2.5">
                <div>
                  <span class="text-xs font-extrabold text-white">${item.name}</span>
                  <span class="ml-2 rounded-md px-2 py-0.5 font-mono text-[10px] font-extrabold ${
                    isPending
                      ? 'border border-gold-500/40 bg-gold-500/15 text-gold-300'
                      : 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  }">${isPending ? '未到賬（待收款）' : '已到賬'}</span>
                  <div class="mt-0.5 font-mono text-[11px] text-slate-400">
                    結算日：${item.settledDate || '-'}${item.payoutNote ? ` · ${item.payoutNote}` : ''}${
                      item.receivedAt ? ` · 收款時間：${new Date(item.receivedAt).toLocaleString('zh-HK')}` : ''
                    }
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <div class="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value="${amt}"
                      onchange="updateSettlementAmount('${item.id}', this.value)"
                      ${!isPending ? 'disabled' : ''}
                      class="v-input num w-24 px-2 py-1 text-right font-mono text-xs font-bold"
                      title="修改待收金額"
                    />
                    <span class="font-mono text-[11px] text-slate-400">HK$</span>
                  </div>
                  <button
                    type="button"
                    onclick="triggerConfirmStorePayout('${item.id}')"
                    ${!isPending || amt <= 0 ? 'disabled' : ''}
                    class="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-black text-obsidian hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    確認已收款
                  </button>
                </div>
              </div>
            `;
          })
          .join('');
      }

      const logs = settlementModuleState.cashState.payoutLogs || [];
      if (logs.length === 0) {
        logsEl.innerHTML = '<div class="text-[11px] text-slate-500">尚未有已確認收款入帳紀錄。</div>';
      } else {
        logsEl.innerHTML = logs
          .map(
            (l) => `
            <div class="flex flex-wrap items-center justify-between gap-1 rounded-lg border border-borderline/70 bg-cardbg/70 px-3 py-1.5 font-mono text-[11px]">
              <span><strong class="text-white">${l.storeOrPoolName}</strong> 確認收款 <strong class="text-emerald-400">+HK$ ${Number(l.amount).toLocaleString('en-HK')}</strong>${l.note ? ` (${l.note})` : ''}</span>
              <span class="text-slate-400">可用淨現金：HK$ ${Number(l.previousAvailableNetCash).toLocaleString('en-HK')} → <strong class="text-emerald-300">HK$ ${Number(l.newAvailableNetCash).toLocaleString('en-HK')}</strong></span>
            </div>
          `
          )
          .join('');
      }
    }

    async function addPendingSettlementItem() {
      const nameInput = document.getElementById('settleNewName');
      const amtInput = document.getElementById('settleNewAmount');
      const noteInput = document.getElementById('settleNewNote');
      const name = (nameInput?.value || '').trim();
      const payoutAmount = Number(amtInput?.value || 0);
      const payoutNote = (noteInput?.value || '').trim();

      if (!name) return showToast('請輸入鋪名或福袋池名稱', 'warn');
      if (!(payoutAmount > 0)) return showToast('請輸入大於 0 嘅未到賬應收金額', 'warn');

      const newItem = {
        id: `SET_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        settledDate: new Date().toISOString().slice(0, 10),
        payoutAmount,
        status: 'settled_pending_payout',
        receivedAt: null,
        payoutNote
      };

      settlementModuleState.settlements = [newItem, ...(settlementModuleState.settlements || [])];
      await saveSettlementPayoutToIDB(
        settlementDb,
        settlementModuleState.cashState,
        settlementModuleState.settlements,
        newItem
      );
      if (nameInput) nameInput.value = '';
      if (amtInput) amtInput.value = '';
      if (noteInput) noteInput.value = '';
      renderNetCashSettlementPanel();
      showToast(`已新增「${name}」未到賬款項 HK$ ${payoutAmount.toLocaleString('en-HK')}`, 'success');
    }

    async function updateSettlementAmount(settlementId, val) {
      const nextAmt = Math.max(0, Number(val || 0));
      let updatedTarget = null;
      settlementModuleState.settlements = (settlementModuleState.settlements || []).map((s) => {
        if (s.id === settlementId && s.status === 'settled_pending_payout') {
          updatedTarget = { ...s, payoutAmount: nextAmt };
          return updatedTarget;
        }
        return s;
      });
      if (updatedTarget) {
        await saveSettlementPayoutToIDB(
          settlementDb,
          settlementModuleState.cashState,
          settlementModuleState.settlements,
          updatedTarget
        );
        renderNetCashSettlementPanel();
      }
    }

    function triggerConfirmStorePayout(settlementId) {
      const target = (settlementModuleState.settlements || []).find((s) => s.id === settlementId);
      if (!target || target.status !== 'settled_pending_payout') return;
      const amt = Number(target.payoutAmount || 0);
      if (!(amt > 0)) return showToast('應收金額必須大於 HK$ 0', 'warn');

      const nextCash = Number(settlementModuleState.cashState.availableNetCash || 0) + amt;
      openConfirmModal(
        '💵 確認已收款轉入可用淨現金',
        `確認收到「${target.name}」款項 HK$ ${amt.toLocaleString('en-HK')}？\n確認後可用淨現金將由 HK$ ${Number(settlementModuleState.cashState.availableNetCash || 0).toLocaleString('en-HK')} 增至 HK$ ${nextCash.toLocaleString('en-HK')}。`,
        async () => {
          try {
            const res = confirmStorePayout({
              cashState: settlementModuleState.cashState,
              settlements: settlementModuleState.settlements,
              settlementId,
              note: target.payoutNote || ''
            });
            settlementModuleState.cashState = res.cashState;
            settlementModuleState.settlements = res.settlements;
            await saveSettlementPayoutToIDB(
              settlementDb,
              settlementModuleState.cashState,
              settlementModuleState.settlements,
              res.receivedItem
            );
            renderNetCashSettlementPanel();
            showToast(`已確認「${target.name}」收款 HK$ ${amt.toLocaleString('en-HK')} 並加落可用淨現金`, 'success');
          } catch (err) {
            showToast(err.message || '確認收款失敗', 'err');
          }
        }
      );
    }

    (async function initSettlementModule() {
      try {
        settlementDb = await openSettlementIDB();
        settlementModuleState = await loadSettlementStateFromIDB(settlementDb);
      } catch (e) {
        console.warn('Settlement IDB fallback:', e);
      }
      const origRenderCashFlow = window.renderCashFlowMonitor;
      if (typeof origRenderCashFlow === 'function') {
        window.renderCashFlowMonitor = function () {
          origRenderCashFlow.apply(this, arguments);
          renderNetCashSettlementPanel();
        };
      }
      renderNetCashSettlementPanel();
    })();