const fs = require('fs');
globalThis.document = { getElementById: () => null };
const stub = 'function clampv(v,a,b){return Math.min(b,Math.max(a,v));}function dot3(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}function cross3(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}function norm3(a){const l=Math.hypot(a[0],a[1],a[2]);return [a[0]/l,a[1]/l,a[2]/l];}let FB_ACTIVE=false;let clock=0,lastInput=-100;const st={x:0,y:150,z:0,yaw:2.8,pitch:0.15,roll:0};function cameraVectors(){const cp=Math.cos(st.pitch);const f=[Math.cos(st.yaw)*cp,Math.sin(st.pitch),Math.sin(st.yaw)*cp];const r=norm3([-f[2],0,f[0]]);const up=cross3(r,f);return {f,r,up};}function showHint(){}function syncLabels(){}let todIdx=0,todFrom=null,todT=1,todAuto=0;const EX={};function currentTod(){return {sun:norm3([0.62,0.3,0.42])};}';
const W = new Function(stub + fs.readFileSync('../src/world.js', 'utf8') + fs.readFileSync('../src/titan.js', 'utf8') + ';return {st,NAV,startTrip,navStep,destById,flatCamTitan,len3,sub3,TR,sunTitanFromLocal,norm3,arriveRegion};')();
W.NAV.sunT = W.sunTitanFromLocal(W.norm3([0.62, 0.3, 0.42]));
for (const dest of process.argv.slice(2)) {
  if (W.NAV.site.id !== 'home') W.arriveRegion(W.destById('home'), true);
  W.st.x = 0; W.st.y = 150; W.st.z = 0; W.st.yaw = 2.8; W.st.pitch = 0.15; W.NAV.mode = 'surface'; W.NAV.cam = W.flatCamTitan();
  W.startTrip(W.destById(dest));
  let prevF = W.NAV.cam.F, prevA = W.len3(W.NAV.cam.P) - W.TR, prevV = 0, worst = [0, 0, 0], jerk = [0, 0];
  for (let i = 0; i < 60 * 120 && W.NAV.mode === 'trip'; i++) {
    W.navStep(1 / 60, { dx: 0, dy: 0, zoom: 0, climb: 0 });
    const c = W.NAV.cam, dF = W.len3(W.sub3(c.F, prevF)), a = W.len3(c.P) - W.TR, v = (a - prevA) * 60;
    if (dF > worst[0]) worst = [dF, W.NAV.trip ? W.NAV.trip.t / W.NAV.trip.T : 1, a];
    const rel = Math.abs(v - prevV) / Math.max(Math.abs(v), 0.05);
    if (i > 2 && rel > jerk[0]) jerk = [rel, a];
    prevF = c.F; prevA = a; prevV = v;
  }
  console.log(dest.padEnd(10), 'worst view change per frame', worst[0].toFixed(4), 'at s', worst[1].toFixed(3), 'alt', worst[2].toFixed(1), 'km | worst relative change in climb rate', jerk[0].toFixed(2), 'at', jerk[1].toFixed(1), 'km');
}
