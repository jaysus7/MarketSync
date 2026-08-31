(function () {
  const subscribers = new Set();
  const state = { document: null, designId: null, dirty: false, status: 'SAVED', saving: false, activePageId: null, breakpoint: 'desktop' };
  const emit = () => subscribers.forEach(fn => { try { fn({ ...state }); } catch (_) {} });
  const store = { getState: () => ({ ...state }), subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }, set(patch) { Object.assign(state, patch); emit(); }, hydrate(document, designId) { Object.assign(state, { document, designId: designId || null, dirty: false, status: 'SAVED', saving: false, activePageId: document?.pages?.[0]?.id || null }); emit(); }, update(document, patch = {}) { Object.assign(state, { document, ...patch, dirty: true, status: 'UNSAVED' }); emit(); }, beginSave() { Object.assign(state, { saving: true, status: 'SAVING' }); emit(); }, saved(document, designId) { Object.assign(state, { document: document || state.document, designId: designId || state.designId, dirty: false, saving: false, status: 'SAVED' }); emit(); }, failed() { Object.assign(state, { saving: false, dirty: true, status: 'SAVE FAILED' }); emit(); } };
  window.msDesignStudioStore = store;
  if (!window.__msStudioStore) window.__msStudioStore = store;
})();
