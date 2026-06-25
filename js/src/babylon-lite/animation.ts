// Animation control API (mirrors src/animation public functions). Animation
// orchestration — keyframe sampling, node TRS writeback, world-matrix recompose, and
// (for skins) bone-palette computation — runs natively in C++ each frame. These thin
// wrappers just drive playback state on the native clip via __bl_animControl.
//
// op codes match __bl_animControl in src/lite.cpp: 0=play, 1=pause, 2=stop, 3=goToFrame.

function animId(group: any): number { return group && group._animId != null ? group._animId : -1; }

export function playAnimation(group: any): void {
    const id = animId(group); if (id >= 0) { __bl_animControl(id, 0, 0); if (group) { group.isPlaying = true; } }
}
export function pauseAnimation(group: any): void {
    const id = animId(group); if (id >= 0) { __bl_animControl(id, 1, 0); if (group) { group.isPlaying = false; } }
}
export function stopAnimation(group: any): void {
    const id = animId(group); if (id >= 0) { __bl_animControl(id, 2, 0); if (group) { group.isPlaying = false; } }
}
// goToFrame(group, frame): seek to frame/(frameRate||60) seconds and apply the pose
// immediately (matches Babylon goToFrame, used by the parity scenes to freeze a frame).
export function goToFrame(group: any, frame: number): void {
    const id = animId(group); if (id >= 0) { __bl_animControl(id, 3, frame); }
}

// addAnimationGroups(scene, groups): attach + auto-play (groups from loadGltf are already
// attached by addToScene; this supports the explicit-attach scenes).
export function addAnimationGroups(scene: any, groups: any[]): void {
    if (!scene || !groups) { return; }
    if (!scene.animationGroups) { scene.animationGroups = []; }
    for (let i = 0; i < groups.length; i++) {
        scene.animationGroups.push(groups[i]);
        playAnimation(groups[i]);
    }
}
