(function () { window.msDesignStudioAutosave = { schedule: scene => window.msStudioScheduleAutosave?.(scene), flush: () => window.msStudioAutosaveNow?.() }; })();
