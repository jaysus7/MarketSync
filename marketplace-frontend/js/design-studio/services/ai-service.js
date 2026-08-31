(function () {
  window.msDesignStudioAI = {
    copy: prompt => window.apiSendJson?.('/ai/studio-copy', 'POST', { prompt }),
    template: payload => window.apiSendJson?.('/ai/studio-template', 'POST', payload),
    image: prompt => window.apiSendJson?.('/ai/studio-image', 'POST', { prompt }),
    factualPolicy: { externalLayoutReceivesPlaceholdersOnly: true, canonicalFactsBoundLocally: true, protectedClaimsRequireApproval: true }
  };
})();
