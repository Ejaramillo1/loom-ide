mergeInto(LibraryManager.library, {
  LoomMemory: function(action, object, body) {
    if (!window.loomMemoryListener) {
      window.loomMemoryListener = function(event) {
        if (event.source !== window.parent || event.origin !== window.location.origin || !event.data || event.data.type !== 'loom-memory-result') return;
        Module.SendMessage('Resolute Workbench', 'OnMemoryResult', JSON.stringify(event.data));
      };
      window.addEventListener('message', window.loomMemoryListener);
    }
    window.parent.postMessage({type: 'loom-memory', action: UTF8ToString(action), object: UTF8ToString(object), body: UTF8ToString(body)}, window.location.origin);
  }
});
