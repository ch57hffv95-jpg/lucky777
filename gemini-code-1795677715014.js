// 1. 初始資金狀態（可用淨現金 HK$80,000）
const INITIAL_CASH_STATE = {
  availableNetCash: 80000, // 可用淨現金（已到賬）
  payoutLogs: []           // 已確認收款流水紀錄
};

/**
 * 2. 計算目前總「未到賬 / 待收鋪頭款項」
 * @param {Array<Object>} settlements - 鋪頭或福袋池結算紀錄陣列
 * @returns {number}
 */
function calculatePendingPayout(settlements) {
  return settlements
    .filter((item) => item.status === 'settled_pending_payout')
    .reduce((sum, item) => sum + Number(item.payoutAmount || 0), 0);
}

/**
 * 3. 逐鋪 / 逐池確認收款：未到賬轉入可用淨現金
 * @param {Object} params
 * @param {Object} params.cashState - 目前資金狀態 { availableNetCash, payoutLogs }
 * @param {Array<Object>} params.settlements - 結算紀錄陣列
 * @param {string} params.settlementId - 要確認收款嘅鋪頭/池 ID
 * @param {string} [params.note] - 可選備註（例如銀行過數/FPS/現金）
 * @returns {{ cashState: Object, settlements: Array<Object>, receivedItem: Object }}
 */
function confirmStorePayout({ cashState, settlements, settlementId, note = '' }) {
  const targetIndex = settlements.findIndex((s) => s.id === settlementId);
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

  // 更新該鋪 / 該池狀態為已到賬
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

  // 新增收款流水紀錄
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
    receivedItem: target
  };
}

/**
 * 4. 寫入 IndexedDB 範例（配合現有 Object Stores: cashState, settlements）
 */
async function saveSettlementPayoutToIDB(db, nextCashState, nextSettlements, targetSettlement) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['cashState', 'settlements'], 'readwrite');
    tx.objectStore('cashState').put({ key: 'main', ...nextCashState });
    tx.objectStore('settlements').put(targetSettlement);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}