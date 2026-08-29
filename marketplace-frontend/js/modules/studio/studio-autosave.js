/* Debounced draft persistence. Manual Save remains available; this protects work
 * in progress and uses the same server-authoritative revision endpoint. */
(function () {
  let timer = null;
  let lastScene = null;
  window.msStudioScheduleAutosave = function (scene) {
    if (!window.__msStudioStore || !scene) return;
    lastScene = scene;
    window.__msStudioStore.update(window.msStudioSceneToDocument(scene));
    clearTimeout(timer);
    timer = setTimeout(() => window.msStudioAutosaveNow(), 1600);
  };
  window.msStudioAutosaveNow = async function () {
    const id = window.__msStudioStore?.getState().designId;
    if (!id || !lastScene || window.__msStudioStore.getState().saving) return;
    const document = window.msStudioSceneToDocument(lastScene, { title: document.getElementById('studio-design-name')?.value });
    window.__msStudioStore.beginSave();
    try {
      const res = await apiSendJson(`/marketing/studio/designs/${id}`, 'PUT', {
        name: document.title, format_key: document.format_key, width: document.width, height: document.height,
        scene: document, vehicle_id: window.__studioCurrentVehicle?.id || null, change_summary: 'Autosaved Studio draft'
      });
      window.__msStudioStore.saved(res?.design ? (res.design.scene || document) : document, res?.design?.id || id);
    } catch (error) { window.__msStudioStore.failed(); }
  };
})();
