var bg = chrome.extension.getBackgroundPage();

function setMode(mode) {
    bg.al(mode)
}

window.onload = function () {
    var mode = bg.getMode();
    console.info(mode);
    // document.getElementById(mode).className += ' active'

    document.getElementById('auto').addEventListener("click", setMode('auto'));
    document.getElementById('on').addEventListener("click", setMode('on'));
    document.getElementById('off').addEventListener("click", setMode('off'));
}

