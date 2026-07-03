// View switcher: toggle left panel between time and shortcuts mode
window.IslandViewSwitcher = {
  switchToNextView: function() {
    var state = window.IslandState;
    var dom = window.IslandDOM;
    var next = state.leftMode === 'time' ? 'shortcut' : 'time';
    state.leftMode = next;
    dom.leftPanel.classList.remove('time-mode', 'shortcuts-mode');
    dom.leftPanel.classList.add(next === 'shortcut' ? 'shortcuts-mode' : 'time-mode');
  }
};
