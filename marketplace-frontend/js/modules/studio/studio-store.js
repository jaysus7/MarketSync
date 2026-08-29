/* Small client store for durable Studio draft state and save status. */
(function () {
  const subscribers = new Set();
  const state = { document: null, designId: null, dirty: false, saving: false, status: 'SAVED' };
  const emit = () => subscribers.forEach(fn => { try { fn({ ...state }); } catch (_) {} });
  const setStatus = (status, dirty = state.dirty) => { state.status = status; state.dirty = dirty; emit(); };
  window.__msStudioStore = {
    getState: () => ({ ...state }),
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    hydrate(document, designId) { state.document = document; state.designId = designId || null; state.dirty = false; state.status = 'SAVED'; emit(); },
    update(document) { state.document = document; state.dirty = true; state.status = 'UNSAVED'; emit(); },
    beginSave() { state.saving = true; setStatus('SAVING', true); },
    saved(document, designId) { state.document = document || state.document; state.designId = designId || state.designId; state.saving = false; setStatus('SAVED', false); },
    failed() { state.saving = false; setStatus('SAVE FAILED', true); },
    setStatus
  };
})();
