(function () { window.msDesignStudioMedia = { list: () => window.apiGetJson?.('/marketing/assets'), upload: file => window.uploadStudioImage?.({ files: [file] }) }; })();
