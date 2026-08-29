(function () { window.msDesignStudioAI = { copy: prompt => window.apiSendJson?.('/ai/studio-copy', 'POST', { prompt }), image: prompt => window.generateStudioAiImage?.(prompt) }; })();
