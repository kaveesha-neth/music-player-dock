// Electron 41 removes WS_EX_LAYERED when click-through is disabled unless
// setOpacity has made the layered style persistent. Alpha 1 preserves appearance.
export function prepareOverlayWindow(window){
 window.setOpacity(1);
 window.setIgnoreMouseEvents(true);
}
export function setOverlayPassthrough(window,ignore,refreshProtection){
 window.setIgnoreMouseEvents(ignore);
 refreshProtection?.();
}
