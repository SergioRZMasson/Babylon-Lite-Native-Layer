// Animation control API (mirrors src/animation public functions). Animation
// orchestration — keyframe sampling, node TRS writeback, world-matrix recompose, and
// (for skins) bone-palette computation — runs natively in C++ each frame. These thin
// wrappers just drive playback state on the native clip via __bl_animControl.
//
// op codes match __bl_animControl in src/lite.cpp: 0=play, 1=pause, 2=stop, 3=goToFrame.
(function (BL) {
    "use strict";

    function animId(group) { return group && group._animId != null ? group._animId : -1; }

    BL.playAnimation = function (group) {
        const id = animId(group); if (id >= 0) { __bl_animControl(id, 0, 0); if (group) { group.isPlaying = true; } }
    };
    BL.pauseAnimation = function (group) {
        const id = animId(group); if (id >= 0) { __bl_animControl(id, 1, 0); if (group) { group.isPlaying = false; } }
    };
    BL.stopAnimation = function (group) {
        const id = animId(group); if (id >= 0) { __bl_animControl(id, 2, 0); if (group) { group.isPlaying = false; } }
    };
    // goToFrame(group, frame): seek to frame/(frameRate||60) seconds and apply the pose
    // immediately (matches Babylon goToFrame, used by the parity scenes to freeze a frame).
    BL.goToFrame = function (group, frame) {
        const id = animId(group); if (id >= 0) { __bl_animControl(id, 3, frame); }
    };

    // addAnimationGroups(scene, groups): attach + auto-play (groups from loadGltf are
    // already attached by addToScene; this supports the explicit-attach scenes).
    BL.addAnimationGroups = function (scene, groups) {
        if (!scene || !groups) { return; }
        if (!scene.animationGroups) { scene.animationGroups = []; }
        for (let i = 0; i < groups.length; i++) {
            scene.animationGroups.push(groups[i]);
            BL.playAnimation(groups[i]);
        }
    };
})(globalThis.__BL);
