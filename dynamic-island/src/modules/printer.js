// Printer status display
window.IslandPrinter = {
  init: function() {
    var invoke = window.__TAURI__.core.invoke;
    var listen = window.__TAURI__.event.listen;

    function getStatusColor(status) {
      var map = {
        printing: '#eab308',
        completed: '#22c55e',
        failed: '#ef4444',
        paused: '#ef4444',
        disconnected: '#6b7280',
        no_printer: '#6b7280',
      };
      return map[status] || '#6b7280';
    }

    function getStatusText(status) {
      var map = {
        printing: '打印中',
        completed: '已完成',
        failed: '失败',
        paused: '暂停',
        disconnected: '未连接',
        no_printer: '未配置',
      };
      return map[status] || '未知';
    }

    function formatTime(minutes) {
      if (minutes <= 0) return '--';
      var h = Math.floor(minutes / 60);
      var m = minutes % 60;
      return h > 0 ? h + ':' + String(m).padStart(2, '0') : '0:' + String(m).padStart(2, '0');
    }

    function updatePrinter(index, status) {
      var selector = index === 0 ? '.printer-unit' : '.printer-unit-2';
      var progress = document.querySelector(selector + ' .printer-progress');
      var percent = document.querySelector(selector + ' .printer-percent');
      var name = document.querySelector(selector + ' .printer-name');
      var statusEl = document.querySelector(selector + ' .printer-status');

      if (progress) {
        var circumference = 2 * Math.PI * 12;
        var offset = circumference - (status.progress / 100) * circumference;
        progress.style.strokeDashoffset = offset;
        progress.style.stroke = getStatusColor(status.status);
      }

      if (percent) percent.textContent = status.progress + '%';
      if (name) name.textContent = status.name || (index + 1) + '号';
      if (statusEl) {
        statusEl.textContent = status.status === 'printing'
          ? formatTime(status.remaining_time)
          : getStatusText(status.status);
      }
    }

    async function updatePrinter1FromPriority() {
      try {
        var status = await invoke('get_priority_printer_status');
        updatePrinter(0, status);
      } catch (e) {
        console.error('[Printer]', e);
      }
    }

    async function updatePrinter2FromSecondary() {
      try {
        var status = await invoke('get_secondary_printer_status');
        updatePrinter(1, status);
      } catch (e) {
        console.error('[Printer]', e);
      }
    }

    listen('printer-status', function() {
      updatePrinter1FromPriority();
      updatePrinter2FromSecondary();
    });

    listen('printer-configs-changed', function() {
      updatePrinter1FromPriority();
      updatePrinter2FromSecondary();
    });

    updatePrinter1FromPriority();
    updatePrinter2FromSecondary();
  }
};
